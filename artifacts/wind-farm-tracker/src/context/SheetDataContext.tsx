import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchLocations,
  fetchCampaigns,
  fetchCables,
  fetchStrings,
  computeStringGroups,
} from "@/lib/sheetParser";
import type { Location, Campaign, StringGroup, CableDef, StringDef } from "@/lib/types";

interface SheetDataContextValue {
  locations: Location[];
  campaigns: Campaign[];
  stringGroups: StringGroup[];
  cables: CableDef[];
  stringDefs: StringDef[];
  isLoading: boolean;
  isError: boolean;
  locationById: Map<string, Location>;
  locationByName: Map<string, Location>;
  cableByName: Map<string, CableDef>;
}

const SheetDataContext = createContext<SheetDataContextValue | null>(null);

export function SheetDataProvider({ children }: { children: ReactNode }) {
  const locQuery = useQuery({
    queryKey: ["sheet", "locations"],
    queryFn: fetchLocations,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const campQuery = useQuery({
    queryKey: ["sheet", "campaigns"],
    queryFn: fetchCampaigns,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const cableQuery = useQuery({
    queryKey: ["sheet", "cables"],
    queryFn: fetchCables,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const stringQuery = useQuery({
    queryKey: ["sheet", "strings"],
    queryFn: fetchStrings,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const locations  = locQuery.data    ?? [];
  const campaigns  = campQuery.data   ?? [];
  const cables     = cableQuery.data  ?? [];
  const stringDefs = stringQuery.data ?? [];

  const stringGroups = useMemo(() => computeStringGroups(locations), [locations]);

  const locationById = useMemo(() => {
    const m = new Map<string, Location>();
    for (const loc of locations) {
      if (loc.locationId) m.set(loc.locationId, loc);
    }
    return m;
  }, [locations]);

  const locationByName = useMemo(() => {
    const m = new Map<string, Location>();
    for (const loc of locations) {
      if (loc.name) m.set(loc.name, loc);
    }
    return m;
  }, [locations]);

  const cableByName = useMemo(() => {
    const m = new Map<string, CableDef>();
    for (const cable of cables) {
      if (cable.cableName) m.set(cable.cableName, cable);
    }
    return m;
  }, [cables]);

  return (
    <SheetDataContext.Provider
      value={{
        locations,
        campaigns,
        stringGroups,
        cables,
        stringDefs,
        isLoading: locQuery.isLoading || campQuery.isLoading || cableQuery.isLoading || stringQuery.isLoading,
        isError: locQuery.isError || campQuery.isError || cableQuery.isError || stringQuery.isError,
        locationById,
        locationByName,
        cableByName,
      }}
    >
      {children}
    </SheetDataContext.Provider>
  );
}

export function useSheetData() {
  const ctx = useContext(SheetDataContext);
  if (!ctx) throw new Error("useSheetData must be used within SheetDataProvider");
  return ctx;
}
