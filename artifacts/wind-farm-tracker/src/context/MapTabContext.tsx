import { createContext, useContext, useState, type ReactNode } from "react";

export type ProjectTab = "all" | "T1L11" | "T2G07" | "T3G15" | "export";

export const PROJECT_TABS: { id: ProjectTab; label: string }[] = [
  { id: "all",    label: "CVOW1 · All" },
  { id: "T2G07",  label: "CVOW1-T2G07" },
  { id: "T1L11",  label: "CVOW1-T1L11" },
  { id: "T3G15",  label: "CVOW1-T3G15" },
  { id: "export", label: "CVOW1 Export Cables" },
];

interface MapTabContextValue {
  activeTab: ProjectTab;
  setActiveTab: (tab: ProjectTab) => void;
  selectedDate: Date | null;
  setSelectedDate: (d: Date | null) => void;
  selectedString: string | null;
  setSelectedString: (s: string | null) => void;
}

const MapTabContext = createContext<MapTabContextValue | null>(null);

const FALLBACK: MapTabContextValue = {
  activeTab: "all",
  setActiveTab: () => {},
  selectedDate: null,
  setSelectedDate: () => {},
  selectedString: null,
  setSelectedString: () => {},
};

export function MapTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<ProjectTab>("all");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedString, setSelectedString] = useState<string | null>(null);

  const handleSetActiveTab = (tab: ProjectTab) => {
    setActiveTab(tab);
    setSelectedString(null);
  };

  return (
    <MapTabContext.Provider value={{ activeTab, setActiveTab: handleSetActiveTab, selectedDate, setSelectedDate, selectedString, setSelectedString }}>
      {children}
    </MapTabContext.Provider>
  );
}

export function useMapTab(): MapTabContextValue {
  return useContext(MapTabContext) ?? FALLBACK;
}
