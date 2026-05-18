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
  computeStringGroups,
} from "@/lib/sheetParser";
import type { Location, Campaign, StringGroup } from "@/lib/types";

interface SheetDataContextValue {
  locations: Location[];
  campaigns: Campaign[];
  stringGroups: StringGroup[];
  isLoading: boolean;
  isError: boolean;
  locationById: Map<string, Location>;
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

  const locations = locQuery.data ?? [];
  const campaigns = campQuery.data ?? [];

  const stringGroups = useMemo(() => computeStringGroups(locations), [locations]);

  const locationById = useMemo(() => {
    const m = new Map<string, Location>();
    for (const loc of locations) {
      if (loc.locationId) m.set(loc.locationId, loc);
    }
    return m;
  }, [locations]);

  return (
    <SheetDataContext.Provider
      value={{
        locations,
        campaigns,
        stringGroups,
        isLoading: locQuery.isLoading,
        isError: locQuery.isError || campQuery.isError,
        locationById,
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
