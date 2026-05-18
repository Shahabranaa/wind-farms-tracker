import { memo, useState, lazy, Suspense } from "react";
import { ChevronLeft, ChevronRight, Activity, CalendarRange, Layers, BarChart3, ClipboardList } from "lucide-react";

const ProgressView  = lazy(() => import("./ProgressView"));
const TimelineView  = lazy(() => import("./TimelineView"));
const SummaryView   = lazy(() => import("./SummaryView"));

type Tab = "progress" | "timeline" | "heatmap" | "gantt" | "summary";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "progress", label: "Progress", icon: <Activity      className="h-3.5 w-3.5" /> },
  { id: "timeline", label: "Timeline", icon: <CalendarRange className="h-3.5 w-3.5" /> },
  { id: "heatmap",  label: "Heatmap",  icon: <Layers        className="h-3.5 w-3.5" /> },
  { id: "gantt",    label: "Gantt",    icon: <BarChart3      className="h-3.5 w-3.5" /> },
  { id: "summary",  label: "Summary",  icon: <ClipboardList className="h-3.5 w-3.5" /> },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center h-24">
      <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <span className="text-lg">🚧</span>
      <span className="text-xs text-muted-foreground">{label} view coming soon</span>
    </div>
  );
}

export default memo(function MapSidebar() {
  const [collapsed, setCollapsed]   = useState(false);
  const [activeTab, setActiveTab]   = useState<Tab>("progress");

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-3 gap-3 border-r border-border flex-shrink-0"
        style={{ width: 40, background: "hsl(207 79% 19%)" }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setCollapsed(false); setActiveTab(t.id); }}
            className={`p-1.5 rounded transition-colors ${activeTab === t.id ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-white/8"}`}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-shrink-0 border-r border-border h-full overflow-hidden"
      style={{ width: 300, background: "hsl(207 79% 19%)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">CVOW1</span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          title="Collapse"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs — scrollable row so all 5 fit */}
      <div className="flex border-b border-border flex-shrink-0 overflow-x-auto scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors border-b-2 whitespace-nowrap min-w-0 ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<TabLoader />}>
          {activeTab === "progress" && <ProgressView />}
          {activeTab === "timeline" && <TimelineView />}
          {activeTab === "heatmap"  && <ComingSoon label="Heatmap" />}
          {activeTab === "gantt"    && <ComingSoon label="Gantt" />}
          {activeTab === "summary"  && <SummaryView />}
        </Suspense>
      </div>
    </div>
  );
});
