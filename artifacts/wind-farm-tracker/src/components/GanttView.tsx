import { memo, useMemo, useState, useCallback, useRef } from "react";
import { useSheetData } from "@/context/SheetDataContext";
import { useMapTab } from "@/context/MapTabContext";
import { statusColor } from "@/lib/types";
import type { StringGroup } from "@/lib/types";

const LABEL_W  = 108;
const CHART_W  = 520;
const ROW_H    = 26;
const HEADER_H = 36;
const GROUP_H  = 22;

const OSS_ORDER = ["T1L11", "T2G07", "T3G15"];

function fmtFull(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function fmtMonthYear(d: Date) {
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
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
}

function Tooltip({ data, x, y }: { data: TooltipData; x: number; y: number }) {
  return (
    <div
      className="fixed z-50 pointer-events-none rounded shadow-xl text-xs"
      style={{
        left: Math.min(x + 12, window.innerWidth - 180),
        top: y - 8,
        background: "#0C3C60",
        border: "1px solid rgba(82,168,236,0.35)",
        padding: "6px 10px",
        minWidth: 160,
      }}
    >
      <div className="font-semibold text-white mb-1">{data.stringId}</div>
      <div className="flex items-center gap-1 mb-0.5">
        <span style={{ color: data.color }}>●</span>
        <span style={{ color: data.color }}>{data.status}</span>
      </div>
      <div style={{ color: "#8ba8c0" }}>{data.pct}% complete</div>
      <div style={{ color: "#8ba8c0" }}>{data.done} / {data.total} locations</div>
    </div>
  );
}

/* ── Gantt row ───────────────────────────────────────── */

const GanttRow = memo(function GanttRow({
  group,
  status,
  color,
  todayPct,
  tickPcts,
  onMouseEnter,
  onMouseLeave,
}: {
  group: StringGroup;
  status: string;
  color: string;
  todayPct: number;
  tickPcts: number[];
  onMouseEnter: (e: React.MouseEvent, data: TooltipData) => void;
  onMouseLeave: () => void;
}) {
  const pct = group.progressPercent;

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
          className="text-[10px] font-medium text-foreground truncate leading-none"
          style={{ maxWidth: 70 }}
        >
          {group.stringId}
        </span>
        <span
          className="text-[8px] px-1 rounded flex-shrink-0 leading-tight"
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

      {/* Bar area */}
      <div
        style={{ width: CHART_W, flexShrink: 0, padding: "4px 6px", height: "100%", display: "flex", alignItems: "center" }}
      >
        <div
          className="relative w-full rounded overflow-hidden cursor-default"
          style={{ height: ROW_H - 10, background: "rgba(255,255,255,0.06)" }}
          onMouseEnter={(e) =>
            onMouseEnter(e, {
              stringId: group.stringId,
              oss: group.subStation,
              status,
              pct,
              done: group.completed,
              total: group.locations.length,
              color,
            })
          }
          onMouseLeave={onMouseLeave}
        >
          {/* Month grid lines */}
          {tickPcts.map((tp, i) =>
            tp > 0 && tp < 100 ? (
              <div
                key={i}
                className="absolute top-0 h-full w-px"
                style={{ left: `${tp}%`, background: "rgba(255,255,255,0.05)" }}
              />
            ) : null
          )}

          {/* Progress fill */}
          {pct > 0 && (
            <div
              className="absolute top-0 left-0 h-full rounded-l"
              style={{
                width: `${pct}%`,
                background: color,
                opacity: pct === 100 ? 0.75 : 0.6,
                transition: "width 0.3s",
              }}
            />
          )}

          {/* % label inside bar (only when wide enough) */}
          {pct >= 20 && (
            <div
              className="absolute top-0 left-0 h-full flex items-center px-1.5"
              style={{ width: `${pct}%`, pointerEvents: "none" }}
            >
              <span className="text-[8px] font-semibold text-white/80">{pct}%</span>
            </div>
          )}

          {/* Today line */}
          {todayPct >= 0 && todayPct <= 100 && (
            <div
              className="absolute top-0 h-full"
              style={{
                left: `${todayPct}%`,
                width: 1.5,
                background: "#52A8EC",
                opacity: 0.9,
                zIndex: 2,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
});

/* ── Group header ────────────────────────────────────── */

function GroupHeader({ oss, count }: { oss: string; count: number }) {
  return (
    <div
      className="flex items-center"
      style={{
        height: GROUP_H,
        background: "rgba(82,168,236,0.08)",
        borderTop: "1px solid rgba(82,168,236,0.18)",
        borderBottom: "1px solid rgba(82,168,236,0.12)",
        position: "sticky",
        top: HEADER_H,
        zIndex: 3,
      }}
    >
      <div
        className="flex items-center gap-2 px-2"
        style={{ width: LABEL_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 5, background: "rgba(12,60,96,0.95)", height: "100%" }}
      >
        <span className="text-[10px] font-bold" style={{ color: "#52A8EC" }}>
          {oss}
        </span>
        <span className="text-[9px]" style={{ color: "#52A8EC99" }}>
          {count}
        </span>
      </div>
      <div style={{ width: CHART_W, flexShrink: 0 }} />
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

  /* Timeline bounds */
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
    return {
      minDate: new Date(minT),
      maxDate: new Date(maxT),
      rangeMs: maxT - minT || 1,
    };
  }, [campaigns]);

  /* Monthly ticks for X axis */
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
  const todayPct = Math.max(-1, Math.min(101, ((today.getTime() - minDate.getTime()) / rangeMs) * 100));

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

  const handleMouseEnter = useCallback((e: React.MouseEvent, data: TooltipData) => {
    setTooltip({ x: e.clientX, y: e.clientY, data });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  /* Resolve status for a group */
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
          {fmtFull(minDate)} → {fmtFull(maxDate)}
        </span>
        <span className="text-[10px] ml-2" style={{ color: "#52A8EC" }}>
          · {filteredGroups.length} strings
        </span>
      </div>

      {/* Scrollable chart */}
      <div ref={containerRef} className="flex-1 overflow-auto" style={{ scrollbarWidth: "thin" }}>
        <div style={{ minWidth: LABEL_W + CHART_W, position: "relative" }}>

          {/* Campaign background bands */}
          <div
            className="absolute top-0 h-full pointer-events-none"
            style={{ left: LABEL_W, right: 0, zIndex: 0 }}
          >
            {campaigns.map((c, i) => {
              const s = c.startDate?.getTime() ?? minDate.getTime();
              const e = c.endDate?.getTime() ?? maxDate.getTime();
              const lp = ((s - minDate.getTime()) / rangeMs) * 100;
              const wp = ((e - s) / rangeMs) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full"
                  style={{
                    left: `${Math.max(0, lp)}%`,
                    width: `${Math.min(100 - Math.max(0, lp), wp)}%`,
                    background:
                      i % 2 === 0
                        ? "rgba(255,255,255,0.012)"
                        : "rgba(0,0,0,0.08)",
                  }}
                />
              );
            })}
          </div>

          {/* Sticky X-axis header */}
          <div
            className="flex border-b border-border"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 6,
              background: "hsl(207 79% 17%)",
              height: HEADER_H,
            }}
          >
            {/* Corner label */}
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
              <span className="text-[9px] uppercase font-semibold text-muted-foreground">
                String
              </span>
            </div>

            {/* Month ticks */}
            <div
              className="relative flex-1"
              style={{ height: HEADER_H, overflow: "hidden", width: CHART_W, flexShrink: 0 }}
            >
              {ticks.map((tick, i) => (
                <div
                  key={i}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `${tick.pct}%`,
                    top: 0,
                    transform: "translateX(-50%)",
                    height: HEADER_H,
                    justifyContent: "flex-end",
                    paddingBottom: 4,
                  }}
                >
                  <div
                    className="w-px"
                    style={{
                      height: 6,
                      background: "rgba(255,255,255,0.15)",
                      marginBottom: 2,
                    }}
                  />
                  <span
                    className="text-[8px] whitespace-nowrap"
                    style={{ color: "#6b8fa8" }}
                  >
                    {fmtMonthYear(tick.date)}
                  </span>
                </div>
              ))}
              {/* Today line in header */}
              {todayPct >= 0 && todayPct <= 100 && (
                <div
                  className="absolute top-0 h-full"
                  style={{
                    left: `${todayPct}%`,
                    width: 1.5,
                    background: "#52A8EC",
                    opacity: 0.5,
                  }}
                >
                  <span
                    className="absolute text-[8px] font-semibold whitespace-nowrap"
                    style={{
                      color: "#52A8EC",
                      top: 2,
                      left: 3,
                    }}
                  >
                    Today
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Rows */}
          {orderedOss.map((oss) => {
            const groups = byOss.get(oss) ?? [];
            return (
              <div key={oss}>
                <GroupHeader oss={oss} count={groups.length} />
                {groups.map((g) => {
                  const status = resolveStatus(g);
                  const color = statusColor(status);
                  return (
                    <GanttRow
                      key={g.stringId}
                      group={g}
                      status={status}
                      color={color}
                      todayPct={todayPct}
                      tickPcts={tickPcts}
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
          className="flex-shrink-0 border-t border-border px-3 py-1.5 flex flex-wrap gap-x-3 gap-y-0.5"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <span className="text-[9px] uppercase font-semibold text-muted-foreground w-full mb-0.5">
            Campaigns
          </span>
          {campaigns.map((c, i) => (
            <span key={i} className="text-[9px]" style={{ color: "#6b8fa8" }}>
              {c.name}
            </span>
          ))}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <Tooltip data={tooltip.data} x={tooltip.x} y={tooltip.y} />
      )}
    </div>
  );
});
