import { memo, useMemo, useState } from "react";
import { useSheetData } from "@/context/SheetDataContext";
import { useMapTab } from "@/context/MapTabContext";

/* ─── helpers ────────────────────────────────────────── */

function pct(n: number, d: number) {
  if (d === 0) return "0.00%";
  return ((n / d) * 100).toFixed(2) + "%";
}

function fmt(n: number, d: number): string {
  return `${n} of ${d}`;
}

/* ─── Pie-slice SVG ──────────────────────────────────── */

function PieSlice({
  done, total, colors,
}: {
  done: number;
  total: number;
  colors: string[];
}) {
  const r = 18;
  const cx = 20;
  const cy = 20;
  const circ = 2 * Math.PI * r;
  const fracs = colors.map((_, i) => (i === 0 ? done / (total || 1) : 0));
  let offset = 0;
  return (
    <svg width={40} height={40} viewBox="0 0 40 40" className="flex-shrink-0 -rotate-90">
      {/* bg track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={7} />
      {fracs.map((f, i) => {
        const dash = f * circ;
        const el = dash > 0 ? (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={colors[i]}
            strokeWidth={7}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset * circ}
          />
        ) : null;
        offset += f;
        return el;
      })}
      {/* remaining grey */}
      {done < total && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={7}
          strokeDasharray={`${((total - done) / (total || 1)) * circ} ${(done / (total || 1)) * circ}`}
          strokeDashoffset={-(done / (total || 1)) * circ}
        />
      )}
    </svg>
  );
}

/* ─── Top summary % cards (image 1) ─────────────────── */

function SummaryCards({
  label, complete, total,
}: {
  label: string;
  complete: number;
  total: number;
}) {
  const incomplete = total - complete;
  return (
    <div className="mb-2">
      <div
        className="text-[11px] font-semibold px-3 py-1.5"
        style={{ background: "rgba(255,255,255,0.08)", color: "#c8d8e8" }}
      >
        {label}
      </div>
      <div className="grid grid-cols-2 gap-2 px-2 py-2">
        {[
          { val: pct(complete, total), label: "Complete",   color: "#22c55e" },
          { val: pct(incomplete, total), label: "Incomplete", color: "#f59e0b" },
        ].map(({ val, label: lbl, color }) => (
          <div
            key={lbl}
            className="flex flex-col items-center justify-center py-3 rounded"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-base font-bold" style={{ color }}>{val}</span>
            <span className="text-[10px] mt-0.5" style={{ color: color + "cc" }}>{lbl}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Collapsible section header ─────────────────────── */

function SectionHeader({
  label, expanded, onToggle,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors"
      style={{ background: "rgba(255,255,255,0.07)", borderTop: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold" style={{ color: "#c8d8e8" }}>{label}</span>
      </div>
      <svg
        width="12" height="12" viewBox="0 0 12 12"
        className="flex-shrink-0 transition-transform"
        style={{ transform: expanded ? "rotate(0deg)" : "rotate(180deg)", color: "#8ba8c0" }}
      >
        <path d="M2 8 L6 4 L10 8" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      </svg>
    </button>
  );
}

/* ─── Pie-row (Location Progress / Cable Ends) ───────── */

function PieRow({
  label, done, total, colors,
}: {
  label: string;
  done: number;
  total: number;
  colors: string[];
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      <PieSlice done={done} total={total} colors={colors} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold" style={{ color: "#e2eaf2" }}>{label}</div>
        <div className="text-[10px] mt-0.5" style={{ color: "#8ba8c0" }}>{fmt(done, total)}</div>
      </div>
    </div>
  );
}

/* ─── Cable-progress bar row ─────────────────────────── */

function BarRow({
  label, done, total, color,
}: {
  label: string;
  done: number;
  total: number;
  color: string;
}) {
  const frac = total > 0 ? done / total : 0;
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px]" style={{ color: "#8ba8c0" }}>{fmt(done, total)}</span>
          <span
            className="text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ml-1"
            style={{ background: "rgba(255,255,255,0.07)", color: "#c8d8e8", maxWidth: 110, textAlign: "right" }}
          >
            {label}
          </span>
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${frac * 100}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Location Progress tasks ────────────────────────── */

const LOC_TASKS = [
  { label: "In Survey Completed", colors: ["#22c55e", "#94a3b8"] },
  { label: "QC",                  colors: ["#ef4444", "#f59e0b"] },
];

/* ─── Cable Ends steps ───────────────────────────────── */

const CABLE_END_STEPS = [
  { label: "Pull in Prep complete",         colors: ["#f97316", "#94a3b8"] },
  { label: "Cable pulled in",               colors: ["#52A8EC", "#94a3b8"] },
  { label: "Temporary Hang Off installed",  colors: ["#a78bfa", "#94a3b8"] },
  { label: "Stripping complete",            colors: ["#34d399", "#94a3b8"] },
  { label: "Permanent hang off installed",  colors: ["#f43f5e", "#94a3b8"] },
  { label: "Resin Poured",                  colors: ["#fbbf24", "#94a3b8"] },
  { label: "Routing and Cleating",          colors: ["#fb923c", "#94a3b8"] },
  { label: "Heating and straightening",     colors: ["#e879f9", "#94a3b8"] },
  { label: "FO Installation",               colors: ["#38bdf8", "#94a3b8"] },
  { label: "HV Termination",               colors: ["#818cf8", "#94a3b8"] },
];

/* ─── Cable Progress tests ───────────────────────────── */

const CABLE_TESTS = [
  { label: "DC Sheath Test",        color: "#f97316" },
  { label: "Pre Term IR",           color: "#a78bfa" },
  { label: "Phase ID",              color: "#f472b6" },
  { label: "Pre Term TDR",          color: "#2dd4bf" },
  { label: "Earth Verification",    color: "#fef08a" },
  { label: "FO Earth verification", color: "#c4b5fd" },
  { label: "Post Term TDR",         color: "#f87171" },
  { label: "Continuity of screens", color: "#93c5fd" },
  { label: "Post Term IR",          color: "#fdba74" },
  { label: "OTDR",                  color: "#86efac" },
  { label: "VLF",                   color: "#fda4af" },
];

/* ─── Main SummaryView ───────────────────────────────── */

export default memo(function SummaryView() {
  const { locations, stringGroups, cables, isLoading } = useSheetData();
  const { activeTab } = useMapTab();

  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [locExpanded, setLocExpanded]         = useState(false);
  const [endsExpanded, setEndsExpanded]       = useState(false);
  const [cableExpanded, setCableExpanded]     = useState(false);

  const { turbines, completed, turbineCount, cableEndCount, cableCount } = useMemo(() => {
    const turbines = locations.filter((l) => {
      if (!l.latLng) return false;
      if (activeTab === "all") return true;
      if (activeTab === "export") return false;
      return l.primarySubStation === activeTab || l.primarySubStation.includes(activeTab);
    });
    const completed = turbines.filter((l) => l.progressStatus === "Completed").length;
    const turbineCount = turbines.length;

    // Build set of string IDs that belong to this tab for cable filtering
    const tabStrings = new Set(turbines.map((l) => l.string).filter(Boolean));

    // Filter real inter-array cables: skip OSP endpoints and onshore anchors
    const tabCables = cables.filter((c) => {
      const b = c.locationB;
      if (!b || b.startsWith("T1") || b.startsWith("T2") || b.startsWith("T3") || b.startsWith("_")) return false;
      if (activeTab === "all" || activeTab === "export") return true;
      return tabStrings.has(c.stringLink);
    });

    const cableCount    = tabCables.length;
    const cableEndCount = cableCount * 2;
    return { turbines, completed, turbineCount, cableEndCount, cableCount };
  }, [locations, cables, activeTab]);

  const completedEnds   = completed * 2;
  const completedCables = Math.max(0, completed - 1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-xs text-muted-foreground animate-pulse">Loading data…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: "thin" }}>

      {/* ── Summary Completion Tab header ── */}
      <button
        onClick={() => setSummaryExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-3 text-left flex-shrink-0 transition-colors hover:bg-white/5"
        style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span className="text-xs font-bold tracking-wide" style={{ color: "#e2eaf2" }}>
          Summary Completion Tab
        </span>
        <svg width="14" height="14" viewBox="0 0 14 14"
          style={{ transform: summaryExpanded ? "rotate(0deg)" : "rotate(180deg)", color: "#8ba8c0", transition: "transform 0.2s" }}>
          <path d="M3 9 L7 5 L11 9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </svg>
      </button>

      {summaryExpanded && (
        <div className="flex-shrink-0">
          <SummaryCards label="Location Progress"    complete={completed}       total={turbineCount} />
          <SummaryCards label="Cable Ends Progress"  complete={completedEnds}   total={cableEndCount} />
          <SummaryCards label="Cable Progress"       complete={completedCables} total={cableCount} />
        </div>
      )}

      {/* ── Location Progress section ── */}
      <SectionHeader
        label="Location Progress"
        expanded={locExpanded}
        onToggle={() => setLocExpanded((v) => !v)}
      />
      {locExpanded && (
        <div className="flex-shrink-0 pb-1">
          {LOC_TASKS.map((t) => (
            <PieRow
              key={t.label}
              label={t.label}
              done={t.label === "In Survey Completed" ? completed : 0}
              total={turbineCount}
              colors={t.colors}
            />
          ))}
        </div>
      )}

      {/* ── Cable Ends Progress section ── */}
      <SectionHeader
        label="Cable Ends Progress"
        expanded={endsExpanded}
        onToggle={() => setEndsExpanded((v) => !v)}
      />
      {endsExpanded && (
        <div className="flex-shrink-0 pb-1">
          {CABLE_END_STEPS.map((s, i) => (
            <PieRow
              key={s.label}
              label={s.label}
              done={i === 0 ? completedEnds : 0}
              total={cableEndCount}
              colors={s.colors}
            />
          ))}
        </div>
      )}

      {/* ── Cable Progress section ── */}
      <SectionHeader
        label="Cable Progress"
        expanded={cableExpanded}
        onToggle={() => setCableExpanded((v) => !v)}
      />
      {cableExpanded && (
        <div className="flex-shrink-0 pb-2">
          {CABLE_TESTS.map((t, i) => (
            <BarRow
              key={t.label}
              label={t.label}
              done={i === 0 ? completedCables : 0}
              total={cableCount}
              color={t.color}
            />
          ))}
          {/* VLF is per-string, not per-cable */}
          <BarRow
            label="VLF"
            done={0}
            total={stringGroups.length}
            color="#fda4af"
          />
        </div>
      )}
    </div>
  );
});
