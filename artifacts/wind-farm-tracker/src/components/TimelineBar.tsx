import { memo, useMemo, useRef } from "react";
import { useSheetData } from "@/context/SheetDataContext";
import { useMapTab } from "@/context/MapTabContext";
import type { Campaign } from "@/lib/types";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CAMPAIGN_COLORS = [
  "#52A8EC", "#22c55e", "#f59e0b", "#a78bfa",
  "#f97316", "#10b981", "#e879f9", "#38bdf8",
];

interface CampaignBar {
  campaign: Campaign;
  left: number;
  width: number;
  color: string;
}

interface Layout {
  bars: CampaignBar[];
  months: { label: string; pct: number }[];
  minMs: number;
  rangeMs: number;
}

function buildLayout(campaigns: Campaign[]): Layout {
  const valid = campaigns.filter((c) => c.startDate && c.endDate);
  const fallbackStart = new Date();
  fallbackStart.setMonth(fallbackStart.getMonth() - 5);
  const fallbackEnd = new Date();
  fallbackEnd.setMonth(fallbackEnd.getMonth() + 7);

  if (valid.length === 0) {
    return {
      bars: [],
      months: buildMonths(fallbackStart, fallbackEnd),
      minMs: fallbackStart.getTime(),
      rangeMs: fallbackEnd.getTime() - fallbackStart.getTime(),
    };
  }

  const allStarts = valid.map((c) => c.startDate!.getTime());
  const allEnds = valid.map((c) => c.endDate!.getTime());
  const rawMin = Math.min(...allStarts);
  const rawMax = Math.max(...allEnds);
  const pad = (rawMax - rawMin) * 0.04;
  const minMs = rawMin - pad;
  const rangeMs = rawMax - rawMin + pad * 2;

  const bars: CampaignBar[] = valid.map((c, i) => ({
    campaign: c,
    left: ((c.startDate!.getTime() - minMs) / rangeMs) * 100,
    width: ((c.endDate!.getTime() - c.startDate!.getTime()) / rangeMs) * 100,
    color: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length],
  }));

  return {
    bars,
    months: buildMonths(new Date(minMs), new Date(minMs + rangeMs)),
    minMs,
    rangeMs,
  };
}

function buildMonths(start: Date, end: Date): { label: string; pct: number }[] {
  const rangeMs = end.getTime() - start.getTime();
  const months: { label: string; pct: number }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const pct = ((cur.getTime() - start.getTime()) / rangeMs) * 100;
    if (pct >= 0 && pct <= 100) {
      months.push({
        label: `${MONTH_NAMES[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`,
        pct,
      });
    }
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export default memo(function TimelineBar() {
  const { campaigns } = useSheetData();
  const { selectedDate, setSelectedDate } = useMapTab();
  const barRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => buildLayout(campaigns), [campaigns]);
  const { bars, months, minMs, rangeMs } = layout;

  const selectedPct = useMemo(() => {
    if (!selectedDate) return null;
    const pct = ((selectedDate.getTime() - minMs) / rangeMs) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [selectedDate, minMs, rangeMs]);

  const todayPct = useMemo(() => {
    const pct = ((Date.now() - minMs) / rangeMs) * 100;
    return pct >= 0 && pct <= 100 ? pct : null;
  }, [minMs, rangeMs]);

  function posToDate(clientX: number): Date {
    if (!barRef.current) return new Date();
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return new Date(minMs + pct * rangeMs);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setSelectedDate(posToDate(e.clientX));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons === 0) return;
    setSelectedDate(posToDate(e.clientX));
  }

  return (
    <div
      className="flex-shrink-0 border-t border-border"
      style={{ height: 48, background: "hsl(207 79% 15%)" }}
    >
      <div className="relative h-full flex flex-col justify-between px-3 py-1 select-none">
        {/* Month tick labels */}
        <div className="relative h-4 pointer-events-none">
          {months.map(({ label, pct }) => (
            <span
              key={label}
              className="absolute text-[9px] text-muted-foreground/55 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${pct}%`, top: 0 }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Scrubber track */}
        <div
          ref={barRef}
          className="relative flex-1 cursor-crosshair"
          style={{ minHeight: 20 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          {/* tick lines */}
          {months.map(({ label, pct }) => (
            <div
              key={`tick-${label}`}
              className="absolute top-0 bottom-0 w-px pointer-events-none"
              style={{ left: `${pct}%`, background: "rgba(255,255,255,0.04)" }}
            />
          ))}

          {/* Campaign bars */}
          {bars.map(({ campaign, left, width, color }) => {
            const isActive =
              selectedDate !== null &&
              campaign.startDate !== null &&
              campaign.endDate !== null &&
              selectedDate >= campaign.startDate &&
              selectedDate <= campaign.endDate;

            return (
              <div
                key={campaign.campaignId}
                className="absolute pointer-events-none rounded-sm"
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 0.5)}%`,
                  top: "50%",
                  transform: "translateY(-50%)",
                  height: isActive ? 14 : 10,
                  background: color,
                  opacity: isActive ? 1 : 0.55,
                  boxShadow: isActive ? `0 0 8px ${color}99` : "none",
                  transition: "height 0.1s, opacity 0.1s",
                }}
                title={`${campaign.name}: ${campaign.startDate?.toLocaleDateString()} – ${campaign.endDate?.toLocaleDateString()}`}
              />
            );
          })}

          {/* Today indicator */}
          {todayPct !== null && (
            <div
              className="absolute top-0 bottom-0 w-px pointer-events-none z-10"
              style={{ left: `${todayPct}%`, background: "rgba(255,70,70,0.65)" }}
            >
              <div
                className="absolute top-0 text-[8px] font-bold -translate-x-1/2 px-1 rounded-sm"
                style={{ background: "rgba(210,40,40,0.85)", color: "#fff" }}
              >
                TODAY
              </div>
            </div>
          )}

          {/* Selected date scrubber */}
          {selectedPct !== null && (
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: `${selectedPct}%` }}
            >
              <div
                className="absolute top-0 bottom-0 w-0.5"
                style={{ background: "rgba(255,200,50,0.9)", left: -1 }}
              />
              {/* Diamond handle */}
              <div
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  top: "50%",
                  left: -6,
                  transform: "translateY(-50%) rotate(45deg)",
                  background: "#ffc832",
                  boxShadow: "0 0 6px rgba(255,200,50,0.8)",
                }}
              />
            </div>
          )}
        </div>

        {/* Clear button */}
        {selectedDate && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors z-30"
            style={{
              background: "rgba(255,200,50,0.15)",
              color: "#ffc832",
              border: "1px solid rgba(255,200,50,0.3)",
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelectedDate(null);
            }}
          >
            Clear ×
          </button>
        )}
      </div>
    </div>
  );
});
