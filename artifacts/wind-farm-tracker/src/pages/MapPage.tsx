import { lazy, Suspense } from "react";
import Navbar from "@/components/Navbar";
import MapSidebar from "@/components/MapSidebar";
import TimelineBar from "@/components/TimelineBar";
import { SheetDataProvider } from "@/context/SheetDataContext";
import { MapTabProvider } from "@/context/MapTabContext";

const MapView = lazy(() => import("@/components/MapView"));

function MapFallback() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "#dde8f0" }}>
      <div className="flex flex-col items-center gap-2">
        <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span className="text-xs text-muted-foreground">Loading map…</span>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <SheetDataProvider>
      <MapTabProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <Navbar />
          <div className="flex flex-1 overflow-hidden min-h-0">
            <MapSidebar />
            <Suspense fallback={<MapFallback />}>
              <MapView />
            </Suspense>
          </div>
          <TimelineBar />
        </div>
      </MapTabProvider>
    </SheetDataProvider>
  );
}
