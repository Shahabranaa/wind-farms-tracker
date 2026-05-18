import { memo, useMemo, useState } from "react";
import { useSheetData } from "@/context/SheetDataContext";
import type { Campaign } from "@/lib/types";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CAMPAIGN_COLORS = [
  "#52A8EC", "#22c55e", "#f59e0b", "#a78bfa",
  "#f97316", "#10b981", "#e879f9", "#38bdf8",
];

function dateToMs(d: Date | null): number {
  return d ? d.getTime() : 0;
}

interface CampaignBar {
  campaign: Campaign;
  left: number;
  width: number;
  color: string;
}

export default memo(function TimelineBar() {
  const { campaigns } = useSheetData();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { bars, months, minMs, rangeMs } = useMemo(() => {
    const valid = campaigns.filter((c) => c.startDate && c.endDate);
    if (valid.length === 0) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 7, 1);
      const minMs = start.getTime();
      const rangeMs = end.getTime() - minMs;
      return { bars: [], months: buildMonths(start, end), minMs, rangeMs };
    }

    const allStarts = valid.map((c) => dateToMs(c.startDate));
    const allEnds = valid.map((c) => dateToMs(c.endDate));
    const minMs = Math.min(...allStarts);
    const maxMs = Math.max(...allEnds);
    const pad = (maxMs - minMs) * 0.04;
    const rangeMs = maxMs - minMs + pad * 2;
    const start = new Date(minMs - pad);
    const end = new Date(maxMs + pad);

    const bars: CampaignBar[] = valid.map((c, i) => ({
      campaign: c,
      left: ((dateToMs(c.startDate) - (minMs - pad)) / rangeMs) * 100,
      width: ((dateToMs(c.endDate!) - dateToMs(c.startDate)) / rangeMs) * 100,
      color: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length],
    }));

    return { bars, months: buildMonths(start, end), minMs: minMs - pad, rangeMs };
  }, [campaigns]);

  return (
    <div
      className="flex-shrink-0 border-t border-border select-none"
      style={{ height: 44, background: "hsl(207 79% 15%)" }}
    >
      <div className="relative h-full overflow-hidden px-2">
        {/* Month tick labels */}
        <div className="absolute top-0 left-0 right-0 h-full pointer-events-none">
          {months.map(({ label, pct }) => (
            <div
              key={label}
              className="absolute top-1.5 text-[9px] text-muted-foreground/60 -translate-x-1/2"
              style={{ left: `${pct}%` }}
            >
              {label}
            </div>
          ))}
          {/* tick lines */}
          {months.map(({ label, pct }) => (
            <div
              key={`tick-${label}`}
              className="absolute bottom-0 w-px"
              style={{
                left: `${pct}%`,
                top: 16,
                background: "rgba(255,255,255,0.05)",
              }}
            />
          ))}
        </div>

        {/* Campaign bars */}
        <div className="absolute left-2 right-2 top-0 bottom-0 flex items-center">
          {bars.map(({ campaign, left, width, color }) => {
            const hovered = hoveredId === campaign.campaignId;
            return (
              <div
                key={campaign.campaignId}
                className="absolute flex items-center transition-all cursor-pointer"
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 1)}%`,
                  top: "50%",
                  transform: "translateY(-50%)",
                  height: hovered ? 16 : 12,
                }}
                onMouseEnter={() => setHoveredId(campaign.campaignId)}
                onMouseLeave={() => setHoveredId(null)}
                title={`${campaign.name}: ${campaign.startDate?.toLocaleDateString()} – ${campaign.endDate?.toLocaleDateString()}`}
              >
                <div
                  className="w-full h-full rounded-sm"
                  style={{
                    background: color,
                    opacity: hovered ? 0.95 : 0.65,
                    boxShadow: hovered ? `0 0 6px ${color}88` : "none",
                  }}
                />
                {hovered && (
                  <div
                    className="absolute bottom-full mb-1.5 left-0 whitespace-nowrap text-[10px] font-medium px-1.5 py-0.5 rounded z-10"
                    style={{ background: "hsl(207 79% 22%)", color: "#e2eaf2", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {campaign.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Today indicator */}
        <TodayIndicator minMs={minMs} rangeMs={rangeMs} />
      </div>
    </div>
  );
});

function TodayIndicator({ minMs, rangeMs }: { minMs: number; rangeMs: number }) {
  const pct = ((Date.now() - minMs) / rangeMs) * 100;
  if (pct < 0 || pct > 100) return null;
  return (
    <div
      className="absolute top-0 bottom-0 w-px z-20 pointer-events-none"
      style={{ left: `${pct}%`, background: "rgba(255,80,80,0.7)" }}
    >
      <div
        className="absolute top-1 text-[8px] font-semibold -translate-x-1/2 px-1 rounded"
        style={{ background: "rgba(220,50,50,0.85)", color: "#fff" }}
      >
        TODAY
      </div>
    </div>
  );
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
