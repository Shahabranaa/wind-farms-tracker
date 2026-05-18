import type { Location, Campaign, StringGroup, CableDef, StringDef } from "./types";

const SHEET_ID = "1qcr0jZEH7pwBmUlr6XS7YK4sa-Kqk2zvXFpBTJ5velw";
const GVIZ_BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

export const LOCATION_GID = "184368806";
export const CAMPAIGN_GID = "1835616815";

interface GVizCell {
  v: unknown;
  f?: string;
}

interface GVizRow {
  c: (GVizCell | null)[] | null;
}

interface GVizTable {
  cols: { id: string; label: string; type: string }[];
  rows: GVizRow[];
}

function parseGVizResponse(text: string): GVizTable {
  const json = text
    .replace(/^\/\*[\s\S]*?\*\/\s*/, "")
    .replace(/^google\.visualization\.Query\.setResponse\(/, "")
    .replace(/\);\s*$/, "");
  return (JSON.parse(json) as { table: GVizTable }).table;
}

function parseGVizDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === "string" && v.startsWith("Date(")) {
    const parts = v.slice(5, -1).split(",").map(Number);
    return new Date(parts[0], parts[1], parts[2], parts[3] ?? 0, parts[4] ?? 0, parts[5] ?? 0);
  }
  return null;
}

function str(row: GVizRow, idx: number): string {
  return String(row.c?.[idx]?.v ?? "");
}

function num(row: GVizRow, idx: number): number | null {
  const v = row.c?.[idx]?.v;
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function parseLatLng(raw: string): [number, number] | null {
  const parts = raw.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length === 2 && isFinite(parts[0]) && isFinite(parts[1])) {
    return [parts[0], parts[1]];
  }
  return null;
}

async function fetchGViz(gid: string): Promise<GVizTable> {
  const res = await fetch(`${GVIZ_BASE}&gid=${gid}`, { cache: "default" });
  if (!res.ok) throw new Error(`GViz fetch failed: ${res.status}`);
  return parseGVizResponse(await res.text());
}

async function fetchGVizBySheet(sheetName: string): Promise<GVizTable> {
  const res = await fetch(
    `${GVIZ_BASE}&sheet=${encodeURIComponent(sheetName)}`,
    { cache: "default" },
  );
  if (!res.ok) throw new Error(`GViz fetch failed for sheet "${sheetName}": ${res.status}`);
  return parseGVizResponse(await res.text());
}

export async function fetchLocations(): Promise<Location[]> {
  const table = await fetchGViz(LOCATION_GID);
  return table.rows
    .map((row): Location => ({
      page1: str(row, 0),
      banner1: str(row, 1),
      header1: str(row, 2),
      infotext1: str(row, 3),
      name: str(row, 4),
      latLng: parseLatLng(str(row, 5)),
      site: str(row, 6),
      field: str(row, 7),
      string: str(row, 8),
      primarySubStation: str(row, 9),
      countOnString: num(row, 10) ?? 0,
      locationType: str(row, 11),
      taskLocation: str(row, 12),
      orderOfMarch: str(row, 13),
      connectedTo: str(row, 14),
      allocatedHours: num(row, 15),
      progressStatus: str(row, 16),
      locationId: str(row, 20),
      createdAt: parseGVizDate(row.c?.[21]?.v),
      updatedAt: parseGVizDate(row.c?.[26]?.v),
    }))
    .filter((loc) => loc.name.length > 0);
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const table = await fetchGViz(CAMPAIGN_GID);
  return table.rows
    .map((row): Campaign => ({
      name: str(row, 0),
      startDate: parseGVizDate(row.c?.[1]?.v),
      endDate: parseGVizDate(row.c?.[2]?.v),
      campaignId: str(row, 3),
      completedToolingSet: str(row, 4),
      vlfTestSet: num(row, 5),
    }))
    .filter((c) => c.name.length > 0);
}

/**
 * Cable sheet columns (0-based after the 4 page/banner/header/infotext cols):
 *   4  Cable Name
 *   5  Location_A
 *   6  Location_B
 *   7  Cable_Site_Link
 *   8  Cable_Field_Link
 *   9  Cable_String_Link
 *  10  Cross_Sectional_Area
 *  11  Cable_String_Count
 *  12  Cable_Estimated_Length
 */
export async function fetchCables(): Promise<CableDef[]> {
  const table = await fetchGVizBySheet("Cable");
  return table.rows
    .map((row): CableDef => ({
      cableName:       str(row, 4),
      locationA:       str(row, 5),
      locationB:       str(row, 6),
      siteLink:        str(row, 7),
      fieldLink:       str(row, 8),
      stringLink:      str(row, 9),
      crossSection:    str(row, 10),
      stringCount:     num(row, 11),
      estimatedLength: num(row, 12),
    }))
    .filter((c) => c.cableName.length > 0 && c.locationB.length > 0);
}

/**
 * String sheet columns (0-based):
 *   4  Site
 *   5  Field
 *   6  String Number
 *   7  String_Starting_Location
 *   8  String_Name
 *   9  String_Progress_Status
 *  10  StringID
 */
export async function fetchStrings(): Promise<StringDef[]> {
  const table = await fetchGVizBySheet("String");
  return table.rows
    .map((row): StringDef => ({
      site:             str(row, 4),
      field:            str(row, 5),
      startingLocation: str(row, 7),
      stringName:       str(row, 8),
      progressStatus:   str(row, 9),
      stringId:         str(row, 10),
    }))
    .filter((s) => s.stringName.length > 0);
}

export function computeStringGroups(locations: Location[]): StringGroup[] {
  const map = new Map<string, Location[]>();
  for (const loc of locations) {
    if (!loc.string) continue;
    const bucket = map.get(loc.string);
    if (bucket) bucket.push(loc);
    else map.set(loc.string, [loc]);
  }

  return Array.from(map.entries())
    .map(([stringId, locs]): StringGroup => {
      const completed  = locs.filter((l) => l.progressStatus === "Completed").length;
      const inProgress = locs.filter((l) => l.progressStatus === "In Progress").length;
      const excluded   = locs.filter((l) => l.progressStatus === "Excluded").length;
      const newCount   = locs.filter((l) => l.progressStatus === "New").length;
      const countable  = locs.length - excluded;
      return {
        stringId,
        subStation: locs[0]?.primarySubStation ?? "",
        locations: locs,
        completed,
        inProgress,
        newCount,
        excluded,
        progressPercent: countable > 0 ? Math.round((completed / countable) * 100) : 0,
      };
    })
    .sort((a, b) => a.stringId.localeCompare(b.stringId));
}
