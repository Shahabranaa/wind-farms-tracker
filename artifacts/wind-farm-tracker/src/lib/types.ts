export type ProgressStatus = "Completed" | "In Progress" | "New" | "Excluded" | string;

export interface Location {
  name: string;
  latLng: [number, number] | null;
  site: string;
  field: string;
  string: string;
  primarySubStation: string;
  countOnString: number;
  locationType: string;
  taskLocation: string;
  orderOfMarch: string;
  connectedTo: string;
  allocatedHours: number | null;
  progressStatus: ProgressStatus;
  locationId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  page1: string;
  banner1: string;
  header1: string;
  infotext1: string;
}

export interface Campaign {
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  campaignId: string;
  completedToolingSet: string;
  vlfTestSet: number | null;
}

export interface StringGroup {
  stringId: string;
  subStation: string;
  locations: Location[];
  completed: number;
  inProgress: number;
  newCount: number;
  excluded: number;
  progressPercent: number;
}

export interface ApiProject {
  id: number;
  name: string;
  slug: string;
  sheetUrl: string | null;
  mapCenter: string | null;
  mapZoom: number | null;
  published: boolean;
  active: boolean;
}

export interface ApiUser {
  id: number;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
  companyId: number | null;
  dateJoined: string;
}

export const STATUS_COLORS: Record<string, string> = {
  Completed: "#22c55e",
  "In Progress": "#52A8EC",
  New: "#94a3b8",
  Excluded: "#475569",
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "#eab308";
}
