import { createContext, useContext, useState, type ReactNode } from "react";

export type ProjectTab = "all" | "T1L11" | "T2G07" | "T3G15" | "export";

export const PROJECT_TABS: { id: ProjectTab; label: string }[] = [
  { id: "all", label: "CVOW1 · All" },
  { id: "T2G07", label: "CVOW1-T2G07" },
  { id: "T1L11", label: "CVOW1-T1L11" },
  { id: "T3G15", label: "CVOW1-T3G15" },
  { id: "export", label: "CVOW1 Export Cables" },
];

interface MapTabContextValue {
  activeTab: ProjectTab;
  setActiveTab: (tab: ProjectTab) => void;
}

const MapTabContext = createContext<MapTabContextValue | null>(null);

export function MapTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<ProjectTab>("all");
  return (
    <MapTabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </MapTabContext.Provider>
  );
}

const FALLBACK: MapTabContextValue = {
  activeTab: "all",
  setActiveTab: () => {},
};

export function useMapTab(): MapTabContextValue {
  return useContext(MapTabContext) ?? FALLBACK;
}
