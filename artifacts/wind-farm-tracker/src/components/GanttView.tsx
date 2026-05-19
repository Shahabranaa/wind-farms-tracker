import { memo, useMemo, useState, useCallback, useRef } from "react";
import { useSheetData } from "@/context/SheetDataContext";
import { useMapTab } from "@/context/MapTabContext";
import type { StringGroup, Campaign } from "@/lib/types";

/* Gantt-specific status colours (spec: completed=green, in-progress=amber, new=slate) */
const GANTT_STATUS_COLOR: Record<string, string> = {
  Completed:   "#22c55e",
  "In Progress": "#f59e0b",
  New:          "#64748b",
  Excluded:     "#475569",
};

function ganttColor(status: string): string {
  return GANTT_STATUS_COLOR[status] ?? "#64748b";
}

const LABEL_W  = 108;
const ROW_H    = 26;
const HEADER_H = 36;
const GROUP_H  = 22;

const OSS_ORDER = ["T1L11", "T2G07", "T3G15"];

function fmtShort(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function fmtMonthYear(d: Date) {
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

/* ── Campaign→String matching ────────────────────────── */

/**
 * Best-effort matching of a campaign to a string.
 * Tries: (1) campaign name contains subStation, (2) campaign name contains stringId fragment.
 * Falls back to the whole-project window (first campaign with valid dates).
 */
interface CampaignAssignment {
  startDate: Date;
  endDate: Date;
  campaignName: string;
  /** false when no campaign matched by name — fallback to project window */
  isMatched: boolean;
}

/**
 * Best-effort matching of a campaign to a string.
 * Tries: (1) campaign name contains subStation, (2) campaign name contains stringId fragment.
 * Falls back to the whole-project window (first campaign with valid dates).
 * Returns isMatched=false when falling back so callers can surface the ambiguity.
 */
function assignCampaign(
  g: StringGroup,
  campaigns: Campaign[],
  projectStart: Date,
  projectEnd: Date,
): CampaignAssignment {
  const oss = g.subStation.toUpperCase();
  const sid = g.stringId.toUpperCase();

  // 1. Try to match by OSS name
  const byOss = campaigns.find((c) => {
    const cn = c.name.toUpperCase();
    return c.startDate && c.endDate && (cn.includes(oss) || oss.includes(cn.slice(0, 4)));
  });
  if (byOss?.startDate && byOss?.endDate) {
    return { startDate: byOss.startDate, endDate: byOss.endDate, campaignName: byOss.name, isMatched: true };
  }

  // 2. Try to match by string ID fragment
  const bySid = campaigns.find((c) => {
    const cn = c.name.toUpperCase();
    return c.startDate && c.endDate && (cn.includes(sid.slice(0, 3)));
  });
  if (bySid?.startDate && bySid?.endDate) {
    return { startDate: bySid.startDate, endDate: bySid.endDate, campaignName: bySid.name, isMatched: true };
  }

  // 3. Fall back to overall project window — mark as unmatched so the UI can indicate this
  const first = campaigns.find((c) => c.startDate && c.endDate);
  return {
    startDate: first?.startDate ?? projectStart,
    endDate: first?.endDate ?? projectEnd,
    campaignName: first?.name ?? "Project",
    isMatched: false,
  };
}

/* ── Tooltip ─────────────────────────────────────────── */

interface TooltipData {
  stringId: string;
  oss: string;
  status: string;
  pct: number;
  done: number;
  total: number;
  color: string;
  campaignName: string;
  startDate: Date;
  endDate: Date;
}

function Tooltip({ data, x, y }: { data: TooltipData; x: number; y: number }) {
  return (
    <div
      className="fixed z-50 pointer-events-none rounded shadow-xl text-xs"
      style={{
        left: Math.min(x + 14, window.innerWidth - 200),
        top: y - 10,
        background: "#0C3C60",
        border: "1px solid rgba(82,168,236,0.4)",
        padding: "7px 11px",
        minWidth: 175,
      }}
    >
      <div className="font-bold text-white mb-1">{data.stringId}</div>
      <div className="mb-1" style={{ color: "#8ba8c0" }}>
        OSS: <span style={{ color: "#c8d8e8" }}>{data.oss}</span>
      </div>
      <div className="flex items-center gap-1 mb-1">
        <span style={{ color: data.color }}>●</span>
        <span style={{ color: data.color }}>{data.status}</span>
        <span style={{ color: "#8ba8c0" }}>· {data.pct}%</span>
      </div>
      <div style={{ color: "#8ba8c0" }}>
        {data.done} / {data.total} locations done
      </div>
      <div
        className="mt-1.5 pt-1.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.1)", color: "#6b8fa8" }}
      >
        <div className="truncate">{data.campaignName}</div>
        <div>
          {fmtShort(data.startDate)} → {fmtShort(data.endDate)}
        </div>
      </div>
    </div>
  );
}

/* ── Gantt row ───────────────────────────────────────── */

const GanttRow = memo(function GanttRow({
  group,
  color,
  isMatched,
  todayPct,
  tickPcts,
  barLeftPct,
  barWidthPct,
  onMouseEnter,
  onMouseLeave,
}: {
  group: StringGroup;
  color: string;
  /** Whether this row's campaign window was matched by name (vs. project-wide fallback) */
  isMatched: boolean;
  todayPct: number;
  tickPcts: number[];
  barLeftPct: number;
  barWidthPct: number;
  onMouseEnter: (e: React.MouseEvent, g: StringGroup) => void;
  onMouseLeave: () => void;
}) {
  const pct = group.progressPercent;
  // The fill covers progressPercent of the campaign bar width
  const fillWidthPx = `${pct}%`;

  return (
    <div
      className="flex items-center"
      style={{ height: ROW_H, borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Sticky label */}
      <div
        className="flex items-center gap-1.5 px-2 flex-shrink-0"
        style={{
          width: LABEL_W,
          position: "sticky",
          left: 0,
          zIndex: 4,
          background: "hsl(207 79% 19%)",
          height: "100%",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span
          className="text-[10px] font-medium truncate"
          style={{ maxWidth: 72, color: isMatched ? undefined : "#64748b" }}
          title={isMatched ? undefined : "Campaign window estimated from project range"}
        >
          {group.stringId}{!isMatched && <span style={{ color: "#475569", marginLeft: 2 }}>~</span>}
        </span>
        <span
          className="text-[8px] px-1 rounded flex-shrink-0"
          style={{
            background: color + "25",
            color,
            border: `1px solid ${color}40`,
            paddingTop: 1,
            paddingBottom: 1,
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Timeline area */}
      <div
        className="relative flex-1"
        style={{ height: "100%", position: "relative" }}
        onMouseEnter={(e) => onMouseEnter(e, group)}
        onMouseLeave={onMouseLeave}
      >
        {/* Month grid lines */}
        {tickPcts.map((tp, i) =>
          tp > 0 && tp < 100 ? (
            <div
              key={i}
              className="absolute top-0 h-full w-px"
              style={{ left: `${tp}%`, background: "rgba(255,255,255,0.04)", zIndex: 0 }}
            />
          ) : null
        )}

        {/* Campaign date-range bar — entire bar is status-colored */}
        <div
          className="absolute rounded"
          style={{
            left: `${Math.max(0, barLeftPct)}%`,
            width: `${Math.min(100 - Math.max(0, barLeftPct), barWidthPct)}%`,
            top: "20%",
            height: "60%",
            background: color + "28",   /* status-tinted track */
            border: `1px solid ${color}50`,
            overflow: "hidden",
            cursor: "default",
          }}
        >
          {/* Completion fill — brighter status color */}
          <div
            className="absolute top-0 left-0 h-full"
            style={{
              width: fillWidthPx,
              background: color,
              opacity: pct === 100 ? 0.80 : 0.65,
              transition: "width 0.3s",
            }}
          />
          {/* % label */}
          {pct >= 22 && (
            <div className="absolute top-0 left-0 h-full flex items-center px-1.5 pointer-events-none">
              <span className="text-[8px] font-semibold text-white/80">{pct}%</span>
            </div>
          )}
        </div>

        {/* Today line */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div
            className="absolute top-0 h-full"
            style={{ left: `${todayPct}%`, width: 1.5, background: "#52A8EC", opacity: 0.85, zIndex: 3 }}
          />
        )}
      </div>
    </div>
  );
});

/* ── Group header ────────────────────────────────────── */

function GroupHeader({ oss, count, top }: { oss: string; count: number; top: number }) {
  return (
    <div
      className="flex items-center"
      style={{
        height: GROUP_H,
        background: "rgba(82,168,236,0.08)",
        borderTop: "1px solid rgba(82,168,236,0.18)",
        borderBottom: "1px solid rgba(82,168,236,0.12)",
        position: "sticky",
        top,
        zIndex: 3,
      }}
    >
      <div
        className="flex items-center gap-2 px-2"
        style={{
          width: LABEL_W,
          flexShrink: 0,
          position: "sticky",
          left: 0,
          zIndex: 5,
          background: "rgba(12,60,96,0.95)",
          height: "100%",
        }}
      >
        <span className="text-[10px] font-bold" style={{ color: "#52A8EC" }}>{oss}</span>
        <span className="text-[9px]" style={{ color: "#52A8EC80" }}>{count}</span>
      </div>
      <div className="flex-1" />
    </div>
  );
}

/* ── Main GanttView ──────────────────────────────────── */

export default memo(function GanttView() {
  const { campaigns, stringGroups, stringDefs, isLoading } = useSheetData();
  const { activeTab } = useMapTab();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: TooltipData } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stringDefByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const sd of stringDefs) {
      if (sd.stringName && sd.progressStatus) m.set(sd.stringName, sd.progressStatus);
    }
    return m;
  }, [stringDefs]);

  /* Timeline bounds from campaign dates */
  const { minDate, maxDate, rangeMs } = useMemo(() => {
    const dates = campaigns
      .flatMap((c) => [c.startDate, c.endDate])
      .filter((d): d is Date => d instanceof Date && isFinite(d.getTime()));
    if (!dates.length) {
      const now = new Date();
      const s = new Date(now.getFullYear(), 0, 1);
      const e = new Date(now.getFullYear() + 1, 11, 31);
      return { minDate: s, maxDate: e, rangeMs: e.getTime() - s.getTime() };
    }
    const minT = Math.min(...dates.map((d) => d.getTime()));
    const maxT = Math.max(...dates.map((d) => d.getTime()));
    return { minDate: new Date(minT), maxDate: new Date(maxT), rangeMs: maxT - minT || 1 };
  }, [campaigns]);

  /* Monthly ticks */
  const ticks = useMemo(() => {
    const result: { date: Date; pct: number }[] = [];
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur.getTime() <= maxDate.getTime()) {
      const pct = ((cur.getTime() - minDate.getTime()) / rangeMs) * 100;
      if (pct >= 0 && pct <= 100) result.push({ date: new Date(cur), pct });
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  }, [minDate, maxDate, rangeMs]);

  const tickPcts = useMemo(() => ticks.map((t) => t.pct), [ticks]);

  const today = new Date();
  const todayPct = ((today.getTime() - minDate.getTime()) / rangeMs) * 100;

  /* Filter & group by OSS */
  const filteredGroups = useMemo(() => {
    if (activeTab === "export") return [];
    if (activeTab === "all") return stringGroups;
    return stringGroups.filter(
      (g) => g.subStation === activeTab || g.subStation.includes(activeTab)
    );
  }, [stringGroups, activeTab]);

  const byOss = useMemo(() => {
    const map = new Map<string, StringGroup[]>();
    for (const g of filteredGroups) {
      const oss = g.subStation || "Other";
      const arr = map.get(oss) ?? [];
      arr.push(g);
      map.set(oss, arr);
    }
    return map;
  }, [filteredGroups]);

  /* Pre-compute campaign assignment per string */
  const campaignAssignment = useMemo(() => {
    const m = new Map<string, CampaignAssignment>();
    for (const g of filteredGroups) {
      m.set(g.stringId, assignCampaign(g, campaigns, minDate, maxDate));
    }
    return m;
  }, [filteredGroups, campaigns, minDate, maxDate]);

  const resolveStatus = useCallback(
    (g: StringGroup): string => {
      const sd = stringDefByName.get(g.stringId);
      if (sd) return sd;
      if (g.progressPercent === 100) return "Completed";
      if (g.progressPercent > 0 || g.inProgress > 0) return "In Progress";
      return "New";
    },
    [stringDefByName]
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, g: StringGroup) => {
      const status = resolveStatus(g);
      const color = ganttColor(status);
      const ca = campaignAssignment.get(g.stringId)!;
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        data: {
          stringId: g.stringId,
          oss: g.subStation,
          status,
          pct: g.progressPercent,
          done: g.completed,
          total: g.locations.length,
          color,
          campaignName: ca.campaignName,
          startDate: ca.startDate,
          endDate: ca.endDate,
        },
      });
    },
    [resolveStatus, campaignAssignment]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  /* ── Render ── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
      </div>
    );
  }

  if (activeTab === "export") {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
        <span className="text-xs text-muted-foreground">No string data for export cable view.</span>
      </div>
    );
  }

  const orderedOss = [
    ...OSS_ORDER.filter((o) => byOss.has(o)),
    ...Array.from(byOss.keys()).filter((o) => !OSS_ORDER.includes(o)),
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Date range header */}
      <div
        className="px-3 py-1.5 border-b border-border flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <span className="text-[10px]" style={{ color: "#8ba8c0" }}>
          {fmtShort(minDate)} → {fmtShort(maxDate)}
        </span>
        <span className="text-[10px] ml-2" style={{ color: "#52A8EC" }}>
          · {filteredGroups.length} strings
        </span>
      </div>

      {/* Scrollable chart */}
      <div ref={containerRef} className="flex-1 overflow-auto" style={{ scrollbarWidth: "thin" }}>
        <div style={{ minWidth: LABEL_W + 480, position: "relative" }}>

          {/* Campaign background alternating bands */}
          <div className="absolute top-0 h-full pointer-events-none" style={{ left: LABEL_W, right: 0, zIndex: 0 }}>
            {campaigns.map((c, i) => {
              if (!c.startDate || !c.endDate) return null;
              const lp = ((c.startDate.getTime() - minDate.getTime()) / rangeMs) * 100;
              const wp = ((c.endDate.getTime() - c.startDate.getTime()) / rangeMs) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full"
                  style={{
                    left: `${Math.max(0, lp)}%`,
                    width: `${Math.min(100 - Math.max(0, lp), wp)}%`,
                    background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.07)",
                  }}
                />
              );
            })}
          </div>

          {/* Sticky X-axis header */}
          <div
            className="flex border-b border-border"
            style={{ position: "sticky", top: 0, zIndex: 6, background: "hsl(207 79% 17%)", height: HEADER_H }}
          >
            {/* Corner */}
            <div
              style={{
                width: LABEL_W,
                flexShrink: 0,
                position: "sticky",
                left: 0,
                zIndex: 7,
                background: "hsl(207 79% 17%)",
                borderRight: "1px solid rgba(255,255,255,0.07)",
              }}
              className="flex items-end px-2 pb-1"
            >
              <span className="text-[9px] uppercase font-semibold text-muted-foreground">String</span>
            </div>

            {/* Month ticks */}
            <div className="relative flex-1" style={{ height: HEADER_H, overflow: "hidden" }}>
              {ticks.map((tick, i) => (
                <div
                  key={i}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${tick.pct}%`, top: 0, transform: "translateX(-50%)", height: HEADER_H, justifyContent: "flex-end", paddingBottom: 4 }}
                >
                  <div className="w-px" style={{ height: 6, background: "rgba(255,255,255,0.15)", marginBottom: 2 }} />
                  <span className="text-[8px] whitespace-nowrap" style={{ color: "#6b8fa8" }}>
                    {fmtMonthYear(tick.date)}
                  </span>
                </div>
              ))}
              {/* Today line + label */}
              {todayPct >= 0 && todayPct <= 100 && (
                <div
                  className="absolute top-0 h-full"
                  style={{ left: `${todayPct}%`, width: 1.5, background: "#52A8EC", opacity: 0.6 }}
                >
                  <span className="absolute text-[8px] font-semibold whitespace-nowrap" style={{ color: "#52A8EC", top: 3, left: 3 }}>
                    Today
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* OSS groups and rows */}
          {orderedOss.map((oss) => {
            const groups = byOss.get(oss) ?? [];
            return (
              <div key={oss}>
                <GroupHeader oss={oss} count={groups.length} top={HEADER_H} />
                {groups.map((g) => {
                  const status = resolveStatus(g);
                  const color = ganttColor(status);
                  const ca = campaignAssignment.get(g.stringId)!;
                  const barLeftPct = ((ca.startDate.getTime() - minDate.getTime()) / rangeMs) * 100;
                  const barWidthPct = ((ca.endDate.getTime() - ca.startDate.getTime()) / rangeMs) * 100;
                  return (
                    <GanttRow
                      key={g.stringId}
                      group={g}
                      color={color}
                      isMatched={ca.isMatched}
                      todayPct={todayPct}
                      tickPcts={tickPcts}
                      barLeftPct={barLeftPct}
                      barWidthPct={barWidthPct}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                    />
                  );
                })}
              </div>
            );
          })}

          {filteredGroups.length === 0 && (
            <div className="flex items-center justify-center h-24">
              <span className="text-xs text-muted-foreground">No string data for this view.</span>
            </div>
          )}
        </div>
      </div>

      {/* Campaign legend */}
      {campaigns.length > 0 && (
        <div
          className="flex-shrink-0 border-t border-border px-3 py-1.5"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <span className="text-[9px] uppercase font-semibold text-muted-foreground block mb-0.5">Campaigns</span>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {campaigns.map((c, i) => (
              <span key={i} className="text-[9px]" style={{ color: "#6b8fa8" }}>
                {c.name}{c.startDate && c.endDate ? ` (${fmtShort(c.startDate)}–${fmtShort(c.endDate)})` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && <Tooltip data={tooltip.data} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
});
