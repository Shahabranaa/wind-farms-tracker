import { memo, useMemo } from "react";
import { useSheetData } from "@/context/SheetDataContext";

const BAR_COLORS = [
  "hsl(207 79% 63%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(0 79% 58%)",
];

export default memo(function TimelineView() {
  const { campaigns, isLoading } = useSheetData();

  const { minDate, maxDate, rangeMs } = useMemo(() => {
    const dates = campaigns
      .flatMap((c) => [c.startDate, c.endDate])
      .filter((d): d is Date => d instanceof Date && isFinite(d.getTime()));
    if (!dates.length) return { minDate: new Date(), maxDate: new Date(), rangeMs: 1 };
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    return { minDate: min, maxDate: max, rangeMs: max.getTime() - min.getTime() || 1 };
  }, [campaigns]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div className="flex items-center justify-center h-32 px-4 text-center">
        <span className="text-xs text-muted-foreground">No campaign data available.</span>
      </div>
    );
  }

  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—";

  const today = new Date();
  const todayPct =
    ((today.getTime() - minDate.getTime()) / rangeMs) * 100;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-white/3">
        <p className="text-xs text-muted-foreground">
          {fmt(minDate)} → {fmt(maxDate)}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {campaigns.map((c, i) => {
          const start = c.startDate?.getTime() ?? minDate.getTime();
          const end = c.endDate?.getTime() ?? maxDate.getTime();
          const leftPct = ((start - minDate.getTime()) / rangeMs) * 100;
          const widthPct = ((end - start) / rangeMs) * 100;
          return (
            <div key={c.campaignId || c.name || i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-foreground truncate">{c.name}</span>
                <span className="text-[9px] text-muted-foreground ml-2 flex-shrink-0">
                  {fmt(c.startDate)} – {fmt(c.endDate)}
                </span>
              </div>
              <div className="relative h-5 w-full bg-white/6 rounded overflow-hidden">
                <div
                  className="absolute top-0 h-full rounded"
                  style={{
                    left: `${Math.max(0, leftPct)}%`,
                    width: `${Math.min(100 - leftPct, widthPct)}%`,
                    background: BAR_COLORS[i % BAR_COLORS.length],
                    opacity: 0.85,
                  }}
                />
                {todayPct >= 0 && todayPct <= 100 && (
                  <div
                    className="absolute top-0 h-full w-px bg-white/40"
                    style={{ left: `${todayPct}%` }}
                  />
                )}
              </div>
              {(c.vlfTestSet != null || c.completedToolingSet) && (
                <div className="flex gap-3 mt-0.5">
                  {c.completedToolingSet && (
                    <span className="text-[9px] text-muted-foreground">
                      Tooling: {c.completedToolingSet}
                    </span>
                  )}
                  {c.vlfTestSet != null && (
                    <span className="text-[9px] text-muted-foreground">
                      VLF: {c.vlfTestSet}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
