import { memo, useMemo } from "react";
import { useSheetData } from "@/context/SheetDataContext";
import { useMapTab } from "@/context/MapTabContext";
import { STATUS_COLORS } from "@/lib/types";
import type { StringGroup } from "@/lib/types";

function MiniPie({ completed, inProgress, newCount, excluded }: Pick<StringGroup, "completed" | "inProgress" | "newCount" | "excluded">) {
  const total = completed + inProgress + newCount + excluded;
  if (total === 0) return null;
  const r = 14;
  const cx = 16;
  const cy = 16;
  const circumference = 2 * Math.PI * r;
  const slices = [
    { color: STATUS_COLORS["Completed"],   count: completed },
    { color: STATUS_COLORS["In Progress"], count: inProgress },
    { color: STATUS_COLORS["New"],         count: newCount },
    { color: STATUS_COLORS["Excluded"],    count: excluded },
  ].filter((s) => s.count > 0);
  let offset = 0;
  return (
    <svg width={32} height={32} viewBox="0 0 32 32" className="flex-shrink-0 -rotate-90">
      {slices.map((s, i) => {
        const pct = s.count / total;
        const dash = pct * circumference;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={7}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset * circumference}
          />
        );
        offset += pct;
        return el;
      })}
    </svg>
  );
}

const StringCard = memo(function StringCard({ group }: { group: StringGroup }) {
  return (
    <div className="px-3 py-2.5 border-b border-border last:border-0 hover:bg-white/3 transition-colors">
      <div className="flex items-center gap-2">
        <MiniPie
          completed={group.completed}
          inProgress={group.inProgress}
          newCount={group.newCount}
          excluded={group.excluded}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-foreground truncate">{group.stringId}</span>
            <span className="text-xs font-bold text-primary flex-shrink-0">{group.progressPercent}%</span>
          </div>
          <div className="text-[10px] text-muted-foreground truncate mb-1">
            {group.subStation} · {group.locations.length} locations
          </div>
          <div className="h-1.5 w-full bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${group.progressPercent}%`, background: "hsl(207 79% 63%)" }}
            />
          </div>
          <div className="flex gap-2 mt-1">
            {[
              { label: "Done", val: group.completed,   color: STATUS_COLORS["Completed"] },
              { label: "WIP",  val: group.inProgress,  color: STATUS_COLORS["In Progress"] },
              { label: "New",  val: group.newCount,    color: STATUS_COLORS["New"] },
            ].map(({ label, val, color }) =>
              val > 0 ? (
                <span key={label} className="text-[9px]" style={{ color }}>
                  {val} {label}
                </span>
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

function SummaryBar({ groups }: { groups: StringGroup[] }) {
  const totals = useMemo(() => {
    const t = { completed: 0, inProgress: 0, newCount: 0, excluded: 0, total: 0 };
    for (const g of groups) {
      t.completed  += g.completed;
      t.inProgress += g.inProgress;
      t.newCount   += g.newCount;
      t.excluded   += g.excluded;
      t.total      += g.locations.length;
    }
    return t;
  }, [groups]);

  const countable = totals.total - totals.excluded;
  const overall = countable > 0 ? Math.round((totals.completed / countable) * 100) : 0;

  return (
    <div className="px-3 py-3 border-b border-border bg-white/3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-foreground">Overall Progress</span>
        <span className="text-sm font-bold text-primary">{overall}%</span>
      </div>
      <div className="h-2 w-full bg-white/8 rounded-full overflow-hidden flex">
        {countable > 0 && (
          <>
            <div style={{ width: `${(totals.completed  / countable) * 100}%`, background: STATUS_COLORS["Completed"] }} className="h-full" />
            <div style={{ width: `${(totals.inProgress / countable) * 100}%`, background: STATUS_COLORS["In Progress"] }} className="h-full" />
            <div style={{ width: `${(totals.newCount   / countable) * 100}%`, background: STATUS_COLORS["New"] }} className="h-full" />
          </>
        )}
      </div>
      <div className="flex gap-3 mt-2">
        {[
          { label: "Completed",   val: totals.completed,  color: STATUS_COLORS["Completed"] },
          { label: "In Progress", val: totals.inProgress, color: STATUS_COLORS["In Progress"] },
          { label: "New",         val: totals.newCount,   color: STATUS_COLORS["New"] },
          { label: "Excluded",    val: totals.excluded,   color: STATUS_COLORS["Excluded"] },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex flex-col">
            <span className="text-[10px] font-semibold" style={{ color }}>{val}</span>
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(function ProgressView() {
  const { stringGroups, isLoading, isError } = useSheetData();
  const { activeTab } = useMapTab();

  const filteredGroups = useMemo(() => {
    if (activeTab === "all") return stringGroups;
    if (activeTab === "export") return [];
    return stringGroups.filter(
      (g) => g.subStation === activeTab || g.subStation.includes(activeTab),
    );
  }, [stringGroups, activeTab]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-xs text-muted-foreground animate-pulse">Loading data…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-32 px-4 text-center">
        <span className="text-xs text-destructive">Failed to load sheet data.</span>
      </div>
    );
  }

  if (activeTab === "export") {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
        <svg width="32" height="10" viewBox="0 0 32 10">
          <line x1="0" y1="5" x2="32" y2="5" stroke="#9ca3af" strokeWidth="2.5" strokeDasharray="5 3"/>
        </svg>
        <span className="text-xs text-muted-foreground">CVOW1 Export Cable</span>
        <span className="text-[10px] text-muted-foreground/60">Virginia Beach landfall route</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SummaryBar groups={filteredGroups} />
      <div className="flex-1 overflow-y-auto">
        {filteredGroups.map((g) => (
          <StringCard key={g.stringId} group={g} />
        ))}
      </div>
    </div>
  );
});
