import { memo, useMemo, useState, useCallback } from "react";
import {
  MapContainer, TileLayer, Popup, Tooltip,
  Polyline, Marker, CircleMarker, ImageOverlay, useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { useSheetData } from "@/context/SheetDataContext";
import { useMapTab } from "@/context/MapTabContext";
import { statusColor, STATUS_COLORS } from "@/lib/types";
import type { Location } from "@/lib/types";

const CVOW_CENTER: [number, number] = [36.87, -75.50];
const ZOOM = 10;
const CANVAS_ZOOM_THRESHOLD = 9;
const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors &copy; <a href="https://carto.com">CARTO</a>';

const canvasRenderer = L.canvas({ padding: 0.5 });

/* ─── OSS image overlay bounds (from original map.js) ── */
const OSS_OVERLAYS: { oss: string; bounds: [[number,number],[number,number]] }[] = [
  { oss: "T1L11", bounds: [[36.853722, -75.345648], [36.854525, -75.345030]] },
  { oss: "T2G07", bounds: [[36.915232, -75.415777], [36.916025, -75.415153]] },
  { oss: "T3G15", bounds: [[36.915588, -75.291279], [36.916407, -75.290700]] },
];

/* ─── GeoJSON cable feature types ───────────────────── */

interface CableGeoFeature {
  type: "Feature";
  properties: {
    ID: number;
    String: string;
    OSS: string;
    "WTG from": string;
    "WTG to": string;
    "Cable type": string;
    "Cable ID": string;
  };
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

interface ExportCableFeature {
  type: "Feature";
  properties: { id: number | null; oss: string; name: string };
  geometry: { type: "MultiLineString"; coordinates: [number, number][][] };
}

/* ─── Stable per-string colour palette ──────────────── */

const STRING_COLORS = [
  "#4e9af1", "#34c88a", "#f4b942", "#b87cf5",
  "#f97316", "#14b8a6", "#ec4899", "#22d3ee",
  "#fb7185", "#a3e635", "#818cf8", "#fbbf24",
];

function buildStringColorMap(locations: Location[]): Map<string, string> {
  const strings = Array.from(
    new Set(locations.map((l) => l.string).filter(Boolean)),
  ).sort();
  const m = new Map<string, string>();
  strings.forEach((s, i) => m.set(s, STRING_COLORS[i % STRING_COLORS.length]));
  return m;
}

/* ─── Cable segment types ────────────────────────────── */

interface CableSeg {
  key: string;
  pts: [number, number][];
  color: string;
  kind: "inter-array" | "string-feeder";
  meta?: { from: string; to: string; type: string; string: string; oss: string };
}

const IS_SUBSTATION = (lt: string) =>
  lt === "Substation" || lt === "HV Station" || lt === "Offshore Substation";

const OSS_NAMES = new Set(["T1L11", "T2G07", "T3G15"]);

/* ─── Vessel definitions ─────────────────────────────── */

interface VesselDef {
  id: number;
  pos: [number, number];
  hdg: number;
  name: string;
  type: string;
}

const VESSELS: VesselDef[] = [
  { id: 1,  pos: [37.060, -75.340], hdg: 195, name: "GENESIS VENTURE",     type: "Construction" },
  { id: 2,  pos: [36.985, -75.270], hdg: 140, name: "ACTA CENTAURUS",      type: "Survey" },
  { id: 3,  pos: [37.120, -75.520], hdg: 220, name: "NDURANCE",            type: "Cable-lay" },
  { id: 4,  pos: [36.840, -75.440], hdg: 30,  name: "BRAVE TERN",          type: "Installation" },
  { id: 5,  pos: [36.920, -75.200], hdg: 270, name: "ORION",               type: "Heavy-lift" },
  { id: 6,  pos: [37.180, -75.380], hdg: 160, name: "SEA INSTALLER",       type: "Installation" },
  { id: 7,  pos: [36.780, -75.300], hdg: 350, name: "PACIFIC CONSTRUCTOR", type: "Construction" },
  { id: 8,  pos: [36.870, -75.680], hdg: 85,  name: "SEAWAY STRASHNOV",    type: "Heavy-lift" },
  { id: 9,  pos: [37.040, -75.760], hdg: 10,  name: "SCALDIS ASSISTANT",   type: "Survey" },
  { id: 10, pos: [36.950, -75.830], hdg: 240, name: "CDFS PIONEER",        type: "Support" },
  { id: 11, pos: [37.200, -75.650], hdg: 315, name: "OLYMPIC TAURUS",      type: "Support" },
  { id: 12, pos: [36.720, -75.480], hdg: 60,  name: "VIDAR VIKING",        type: "Survey" },
  { id: 13, pos: [36.990, -75.950], hdg: 180, name: "STRIL MERKUR",        type: "Supply" },
  { id: 14, pos: [37.150, -75.200], hdg: 120, name: "ESVAGT CONNECTOR",    type: "Service" },
  { id: 15, pos: [36.660, -75.360], hdg: 45,  name: "CL PRESTIGE",         type: "Cargo" },
  { id: 16, pos: [37.080, -75.900], hdg: 280, name: "HAVILA JUPITER",      type: "Survey" },
  { id: 17, pos: [36.810, -75.820], hdg: 200, name: "NEXUS",               type: "Support" },
  { id: 18, pos: [37.250, -75.780], hdg: 100, name: "ISLAND CONSTRUCTOR",  type: "Construction" },
  { id: 19, pos: [36.740, -75.620], hdg: 170, name: "HIGHLAND NAVIGATOR",  type: "Supply" },
  { id: 20, pos: [37.010, -75.110], hdg: 230, name: "VOS SWEET",           type: "Service" },
];

/* ─── Enhanced turbine icon with status ring ─────────── */

function createTurbineIcon(
  status: string,
  isSubstation: boolean,
  label: string,
): L.DivIcon {
  const color = statusColor(status);
  const size = isSubstation ? 38 : 26;
  const c = size / 2;
  const ringR = c - 2;
  const ringW = isSubstation ? 4.5 : 3.5;
  const innerR = ringR - ringW - 1;
  const bladeEnd = -(innerR - 2.5);
  const labelY = size + 10;
  const totalH = size + 13;

  const circ = 2 * Math.PI * ringR;

  /* Status ring fill amount */
  let ringFrac = 0;
  let trackOpacity = "0.14";
  if (status === "Completed") {
    ringFrac = 1;
    trackOpacity = "0.08";
  } else if (status === "In Progress") {
    ringFrac = 0.62;
    trackOpacity = "0.14";
  } else if (status === "New") {
    ringFrac = 0.22;
    trackOpacity = "0.18";
  } else {
    ringFrac = 0.08;
    trackOpacity = "0.22";
  }

  const filled = ringFrac * circ;
  const empty  = circ - filled;
  const bladeW = isSubstation ? 1.4 : 1.2;

  const html = `<svg xmlns="http://www.w3.org/2000/svg"
      width="${size}" height="${totalH}" viewBox="0 0 ${size} ${totalH}">
    <!-- dark backing disc -->
    <circle cx="${c}" cy="${c}" r="${ringR}"
      fill="rgba(10,30,50,0.82)"
      stroke="rgba(255,255,255,0.07)" stroke-width="0.6"/>
    <!-- ring track -->
    <circle cx="${c}" cy="${c}" r="${ringR}"
      fill="none" stroke="rgba(255,255,255,${trackOpacity})"
      stroke-width="${ringW}"
      transform="rotate(-90 ${c} ${c})"/>
    <!-- ring filled arc -->
    <circle cx="${c}" cy="${c}" r="${ringR}"
      fill="none" stroke="${color}" stroke-width="${ringW}"
      stroke-dasharray="${filled.toFixed(2)} ${empty.toFixed(2)}"
      stroke-linecap="butt"
      transform="rotate(-90 ${c} ${c})"/>
    <!-- blades -->
    <g transform="translate(${c},${c})">
      <line x1="0" y1="${bladeEnd.toFixed(2)}" x2="0" y2="-2"
        stroke="${color}" stroke-width="${bladeW}" stroke-linecap="round" opacity="0.65"/>
      <line x1="0" y1="${bladeEnd.toFixed(2)}" x2="0" y2="-2"
        stroke="${color}" stroke-width="${bladeW}" stroke-linecap="round" opacity="0.65"
        transform="rotate(120)"/>
      <line x1="0" y1="${bladeEnd.toFixed(2)}" x2="0" y2="-2"
        stroke="${color}" stroke-width="${bladeW}" stroke-linecap="round" opacity="0.65"
        transform="rotate(240)"/>
    </g>
    <!-- hub -->
    <circle cx="${c}" cy="${c}" r="2.2" fill="${color}" opacity="0.92"/>
    <!-- label -->
    <text x="${c}" y="${labelY}"
      text-anchor="middle"
      font-size="${isSubstation ? 8 : 6.5}"
      font-family="Poppins,Arial,sans-serif"
      fill="${isSubstation ? "#e2eaf2" : "#8ba8c0"}"
      font-weight="${isSubstation ? 700 : 600}"
      letter-spacing="0.2">${label}</text>
  </svg>`;

  return L.divIcon({
    html,
    className: "",
    iconSize:    [size, totalH],
    iconAnchor:  [c, c],
    popupAnchor: [0, -(c + 2)],
  });
}

function createVesselIcon(hdg: number): L.DivIcon {
  const html = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="17"
    viewBox="0 0 13 17"
    style="transform:rotate(${hdg}deg);transform-origin:6.5px 8.5px;display:block">
    <polygon points="6.5,1 12,15 6.5,11.5 1,15"
      fill="#3d5a9e" stroke="rgba(255,255,255,0.7)" stroke-width="0.6" opacity="0.92"/>
  </svg>`;
  return L.divIcon({ html, className: "", iconSize: [13, 17], iconAnchor: [6, 8] });
}

/* ─── Zoom tracker ───────────────────────────────────── */

function ZoomTracker({ onChange }: { onChange: (z: number) => void }) {
  useMapEvents({ zoomend: (e) => onChange(e.target.getZoom()) });
  return null;
}

/* ─── Popup content ──────────────────────────────────── */

function LocationPopup({ loc }: { loc: Location }) {
  const color = statusColor(loc.progressStatus);
  return (
    <div style={{ minWidth: 200, fontFamily: "Poppins, sans-serif" }}>
      <div className="font-semibold text-sm mb-1">{loc.header1 || loc.name}</div>
      {loc.infotext1 && (
        <div className="text-xs text-muted-foreground mb-2">{loc.infotext1}</div>
      )}
      <div
        className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mb-2"
        style={{ background: color + "33", color, border: `1px solid ${color}55` }}
      >
        {loc.progressStatus || "Unknown"}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        {loc.site && <><span className="text-muted-foreground">Site</span><span>{loc.site}</span></>}
        {loc.string && <><span className="text-muted-foreground">String</span><span>{loc.string}</span></>}
        {loc.primarySubStation && <><span className="text-muted-foreground">Substation</span><span>{loc.primarySubStation}</span></>}
        {loc.locationType && <><span className="text-muted-foreground">Type</span><span>{loc.locationType}</span></>}
        {loc.connectedTo && <><span className="text-muted-foreground">Connected to</span><span>{loc.connectedTo}</span></>}
        {loc.orderOfMarch && <><span className="text-muted-foreground">Order</span><span>{loc.orderOfMarch}</span></>}
        {loc.allocatedHours != null && <><span className="text-muted-foreground">Alloc. hrs</span><span>{loc.allocatedHours}</span></>}
      </div>
    </div>
  );
}

/* ─── Marker components ──────────────────────────────── */

const TurbineMarker = memo(function TurbineMarker({
  loc, dimmed,
}: { loc: Location; dimmed: boolean }) {
  if (!loc.latLng) return null;
  const isSub = IS_SUBSTATION(loc.locationType);
  const icon = useMemo(
    () => createTurbineIcon(loc.progressStatus, isSub, loc.name),
    [loc.progressStatus, isSub, loc.name],
  );
  return (
    <Marker position={loc.latLng} icon={icon} opacity={dimmed ? 0.18 : 1}>
      <Popup maxWidth={280}><LocationPopup loc={loc} /></Popup>
    </Marker>
  );
});

const CanvasMarker = memo(function CanvasMarker({
  loc, dimmed,
}: { loc: Location; dimmed: boolean }) {
  if (!loc.latLng) return null;
  const color = statusColor(loc.progressStatus);
  const isSub = IS_SUBSTATION(loc.locationType);
  return (
    <CircleMarker
      center={loc.latLng}
      radius={isSub ? 7 : 5}
      renderer={canvasRenderer}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: dimmed ? 0.15 : (loc.progressStatus === "Excluded" ? 0.25 : 0.85),
        weight: dimmed ? 0.5 : 1.5,
      }}
    >
      <Popup maxWidth={280}><LocationPopup loc={loc} /></Popup>
    </CircleMarker>
  );
});

const VesselMarker = memo(function VesselMarker({ v }: { v: VesselDef }) {
  const icon = useMemo(() => createVesselIcon(v.hdg), [v.hdg]);
  return (
    <Marker position={v.pos} icon={icon}>
      <Popup maxWidth={200}>
        <div style={{ fontFamily: "Poppins, sans-serif" }}>
          <div className="font-semibold text-sm mb-0.5">{v.name}</div>
          <div className="text-[11px] text-muted-foreground">{v.type} vessel</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {v.pos[0].toFixed(4)}°N, {Math.abs(v.pos[1]).toFixed(4)}°W · HDG {v.hdg}°
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

/* ─── Cable type filter + legend ────────────────────── */

const CABLE_TYPE_COLORS: Record<string, string> = {
  "630mm": "#52A8EC",
  "240mm": "#f4b942",
};

function Legend({
  showVessels, onToggleVessels, selectedDate,
  activeCableTypes, onToggleCableType,
}: {
  showVessels: boolean;
  onToggleVessels: () => void;
  selectedDate: Date | null;
  activeCableTypes: Set<string>;
  onToggleCableType: (t: string) => void;
}) {
  const statusItems = [
    { label: "Completed",   color: STATUS_COLORS["Completed"] },
    { label: "In Progress", color: STATUS_COLORS["In Progress"] },
    { label: "New",         color: STATUS_COLORS["New"] },
    { label: "Excluded",    color: STATUS_COLORS["Excluded"] },
  ];

  return (
    <>
      <div className="leaflet-bottom leaflet-right" style={{ zIndex: 1000, pointerEvents: "none" }}>
        <div
          className="leaflet-control m-3 px-3 py-2 rounded text-xs"
          style={{ background: "rgba(12,60,96,0.92)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {selectedDate && (
            <div
              className="text-[9px] font-medium mb-1.5 pb-1.5 border-b"
              style={{ color: "#ffc832", borderColor: "rgba(255,200,50,0.2)" }}
            >
              {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          )}
          {statusItems.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2 py-0.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span style={{ color: "#c8d4e0" }}>{label}</span>
            </div>
          ))}

          {/* Cable line types */}
          <div className="mt-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2 py-0.5">
              <svg width="24" height="4" style={{ flexShrink: 0 }}>
                <line x1="0" y1="2" x2="24" y2="2" stroke="#6b8aad" strokeWidth="1.5" strokeOpacity="0.7"/>
              </svg>
              <span style={{ color: "#8ba8c0", fontSize: 10 }}>Inter-array</span>
            </div>
            <div className="flex items-center gap-2 py-0.5">
              <svg width="24" height="4" style={{ flexShrink: 0 }}>
                <line x1="0" y1="2" x2="24" y2="2" stroke="#6b8aad" strokeWidth="3" strokeOpacity="0.9"/>
              </svg>
              <span style={{ color: "#8ba8c0", fontSize: 10 }}>String feeder</span>
            </div>
            <div className="flex items-center gap-2 py-0.5">
              <svg width="24" height="4" style={{ flexShrink: 0 }}>
                <line x1="0" y1="2" x2="24" y2="2" stroke="#9ca3af" strokeWidth="3"
                  strokeDasharray="4 3" strokeOpacity="0.85"/>
              </svg>
              <span style={{ color: "#8ba8c0", fontSize: 10 }}>Export cable</span>
            </div>
          </div>
        </div>
      </div>

      <div className="leaflet-bottom leaflet-left" style={{ zIndex: 1000, pointerEvents: "auto" }}>
        <div className="leaflet-control m-3 flex flex-col gap-1.5">
          {/* Vessel toggle */}
          <button
            onClick={onToggleVessels}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded transition-all"
            style={{
              background: showVessels ? "rgba(61,90,158,0.92)" : "rgba(12,60,96,0.85)",
              color: showVessels ? "#fff" : "#c8d4e0",
              border: `1px solid ${showVessels ? "rgba(61,90,158,0.9)" : "rgba(255,255,255,0.12)"}`,
            }}
          >
            <svg width="9" height="12" viewBox="0 0 9 12" style={{ flexShrink: 0 }}>
              <polygon points="4.5,0 9,10.5 4.5,8 0,10.5" fill="currentColor" opacity="0.9" />
            </svg>
            Vessels
          </button>

          {/* Cable type filters */}
          <div
            className="px-2.5 py-2 rounded"
            style={{ background: "rgba(12,60,96,0.88)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <div className="text-[9px] font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "#8ba8c0" }}>Cable type</div>
            {Object.keys(CABLE_TYPE_COLORS).map((t) => {
              const active = activeCableTypes.has(t);
              const color  = CABLE_TYPE_COLORS[t];
              return (
                <button
                  key={t}
                  onClick={() => onToggleCableType(t)}
                  className="flex items-center gap-2 w-full py-0.5 text-left"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0 transition-opacity"
                    style={{ background: color, opacity: active ? 1 : 0.25 }}
                  />
                  <span
                    className="text-[10px] transition-colors"
                    style={{ color: active ? "#c8d4e0" : "#4a6880" }}
                  >{t}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Main MapView ───────────────────────────────────── */

export default memo(function MapView() {
  const { locations, campaigns, isLoading } = useSheetData();
  const { activeTab, selectedDate, selectedString } = useMapTab();
  const [showVessels, setShowVessels] = useState(true);
  const [mapZoom, setMapZoom] = useState(ZOOM);
  const [activeCableTypes, setActiveCableTypes] = useState<Set<string>>(
    () => new Set(Object.keys(CABLE_TYPE_COLORS)),
  );
  const toggleVessels = useCallback(() => setShowVessels((v) => !v), []);
  const toggleCableType = useCallback((t: string) => {
    setActiveCableTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  /* Lazy-load real cable GeoJSON (cached forever — static asset) */
  const cableGeoQuery = useQuery<CableGeoFeature[]>({
    queryKey: ["geo", "cables"],
    queryFn: async () => {
      const res = await fetch("/cables.geojson");
      if (!res.ok) throw new Error("Failed to load cables.geojson");
      const data = await res.json() as { features: CableGeoFeature[] };
      return data.features;
    },
    staleTime: Infinity,
    gcTime:    Infinity,
  });

  const exportGeoQuery = useQuery<ExportCableFeature[]>({
    queryKey: ["geo", "export-cables"],
    queryFn: async () => {
      const res = await fetch("/export_cables.geojson");
      if (!res.ok) throw new Error("Failed to load export_cables.geojson");
      const data = await res.json() as { features: ExportCableFeature[] };
      return data.features;
    },
    staleTime: Infinity,
    gcTime:    Infinity,
  });

  const showExportOnly = activeTab === "export";

  /* Stable per-string colour map */
  const stringColorMap = useMemo(() => buildStringColorMap(locations), [locations]);

  /* Filter locations shown by the active tab, then by selectedString */
  const mappable = useMemo(() => {
    const withPos = locations.filter((l) => l.latLng !== null);
    if (showExportOnly) return [];
    let filtered = activeTab === "all"
      ? withPos
      : withPos.filter((l) => l.primarySubStation === activeTab || l.primarySubStation.includes(activeTab));
    if (selectedString) {
      filtered = filtered.filter((l) => l.string === selectedString || IS_SUBSTATION(l.locationType));
    }
    return filtered;
  }, [locations, activeTab, showExportOnly, selectedString]);

  /* Campaign-date driven dim set */
  const dimmedIds = useMemo(() => {
    if (!selectedDate || !mappable.length) return new Set<string>();

    const validCampaigns = campaigns.filter((c) => c.startDate && c.endDate);
    if (validCampaigns.length === 0) return new Set<string>();

    const activeCampaigns = validCampaigns.filter(
      (c) => selectedDate >= c.startDate! && selectedDate <= c.endDate!,
    );
    if (activeCampaigns.length === 0) return new Set<string>();

    const activeStrings = new Set<string>();
    for (const c of activeCampaigns) {
      const trimmed = c.name.trim();
      activeStrings.add(trimmed);
      const firstWord = trimmed.split(/[\s\-_]/)[0];
      if (firstWord) activeStrings.add(firstWord);
    }

    const hasStringMatch = mappable.some((l) => activeStrings.has(l.string));
    if (hasStringMatch) {
      return new Set(
        mappable.filter((l) => !activeStrings.has(l.string)).map((l) => l.locationId || l.name),
      );
    }

    const minMs = Math.min(...validCampaigns.map((c) => c.startDate!.getTime()));
    const maxMs = Math.max(...validCampaigns.map((c) => c.endDate!.getTime()));
    const progress = Math.max(0, Math.min(1, (selectedDate.getTime() - minMs) / (maxMs - minMs)));
    const sorted = [...mappable].sort(
      (a, b) => (parseFloat(a.orderOfMarch) || 9999) - (parseFloat(b.orderOfMarch) || 9999),
    );
    const reachedCount = Math.round(progress * sorted.length);
    const reachedSet = new Set(sorted.slice(0, reachedCount).map((l) => l.locationId || l.name));
    return new Set(
      mappable.filter((l) => !reachedSet.has(l.locationId || l.name)).map((l) => l.locationId || l.name),
    );
  }, [selectedDate, campaigns, mappable]);

  /* ── Cable polylines — from real GeoJSON geometry ──────────────────────
   * Each cable feature in cables.geojson carries LineString geometry with
   * the actual GPS waypoints surveyed for that cable segment.
   * - Features where "WTG from" = OSS name are string feeders (thicker).
   * - All others are inter-array cables.
   * Filtered by activeTab (OSS) and selectedString, cable type toggles.
   */
  const { interArray, stringFeeder } = useMemo((): {
    interArray: CableSeg[];
    stringFeeder: CableSeg[];
  } => {
    if (showExportOnly) return { interArray: [], stringFeeder: [] };

    const features = cableGeoQuery.data ?? [];
    const ia: CableSeg[] = [];
    const sf: CableSeg[] = [];

    for (const f of features) {
      const props = f.properties;

      /* Tab filter */
      if (activeTab !== "all" && props.OSS !== activeTab) continue;

      /* String filter */
      if (selectedString && props.String !== selectedString) continue;

      /* Cable type filter */
      if (!activeCableTypes.has(props["Cable type"])) continue;

      /* Convert [lng, lat] → [lat, lng] for Leaflet */
      const pts = f.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      if (pts.length < 2) continue;

      const color = stringColorMap.get(props.String) ?? "#6b8aad";
      const isFeeder = OSS_NAMES.has(props["WTG from"]);
      const meta = {
        from: props["WTG from"],
        to:   props["WTG to"],
        type: props["Cable type"],
        string: props.String,
        oss:  props.OSS,
      };

      if (isFeeder) {
        sf.push({ key: props["Cable ID"], pts, color, kind: "string-feeder", meta });
      } else {
        ia.push({ key: props["Cable ID"], pts, color, kind: "inter-array", meta });
      }
    }

    return { interArray: ia, stringFeeder: sf };
  }, [cableGeoQuery.data, activeTab, selectedString, showExportOnly, stringColorMap, activeCableTypes]);

  /* ── Export cables — from real GeoJSON (MultiLineString geometry) ───── */
  const exportCables = useMemo((): { key: string; pts: [number, number][] }[] => {
    const features = exportGeoQuery.data ?? [];
    if (features.length === 0) return [];

    const result: { key: string; pts: [number, number][] }[] = [];

    for (const f of features) {
      /* Show all export cables when on "export" tab or "all"; filter by OSS otherwise */
      if (activeTab !== "export" && activeTab !== "all") {
        if (f.properties.oss !== activeTab) continue;
      }

      /* MultiLineString: coordinates = array of linestrings */
      f.geometry.coordinates.forEach((line, i) => {
        const pts = line.map(([lng, lat]) => [lat, lng] as [number, number]);
        if (pts.length >= 2) {
          result.push({ key: `export-${f.properties.name}-${i}`, pts });
        }
      });
    }

    return result;
  }, [exportGeoQuery.data, activeTab]);

  /* Which OSS image overlays to show */
  const visibleOssOverlays = useMemo(() => {
    if (showExportOnly) return [];
    if (activeTab === "all") return OSS_OVERLAYS;
    return OSS_OVERLAYS.filter((o) => o.oss === activeTab);
  }, [activeTab, showExportOnly]);

  const useCanvas = mapZoom < CANVAS_ZOOM_THRESHOLD;

  return (
    <div className="relative flex-1 h-full">
      <MapContainer
        center={CVOW_CENTER}
        zoom={ZOOM}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        preferCanvas={false}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        <ZoomTracker onChange={setMapZoom} />

        {/* OSS station image overlays */}
        {visibleOssOverlays.map((o) => (
          <ImageOverlay
            key={o.oss}
            url="/oss_station.png"
            bounds={o.bounds}
            opacity={0.88}
            zIndex={10}
          />
        ))}

        {/* 1 · Inter-array cables — thin, per-string colour */}
        {interArray.map(({ key, pts, color, meta }) => (
          <Polyline
            key={key}
            positions={pts}
            pathOptions={{ color, weight: 1.5, opacity: 0.72 }}
          >
            {meta && (
              <Tooltip sticky>
                <div style={{ fontFamily: "Poppins,sans-serif", fontSize: 11, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{key}</div>
                  <div style={{ color: "#555" }}>{meta.from} → {meta.to}</div>
                  <div style={{ color: "#555" }}>String {meta.string} · {meta.type} · {meta.oss}</div>
                </div>
              </Tooltip>
            )}
          </Polyline>
        ))}

        {/* 2 · String-feeder cables — thicker, per-string colour */}
        {stringFeeder.map(({ key, pts, color, meta }) => (
          <Polyline
            key={key}
            positions={pts}
            pathOptions={{ color, weight: 3.5, opacity: 0.9 }}
          >
            {meta && (
              <Tooltip sticky>
                <div style={{ fontFamily: "Poppins,sans-serif", fontSize: 11, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{key}</div>
                  <div style={{ color: "#555" }}>String feeder · {meta.from} → {meta.to}</div>
                  <div style={{ color: "#555" }}>String {meta.string} · {meta.type} · {meta.oss}</div>
                </div>
              </Tooltip>
            )}
          </Polyline>
        ))}

        {/* 3 · Export cables — thick dashed grey, real GeoJSON geometry */}
        {exportCables.map(({ key, pts }) => (
          <Polyline
            key={key}
            positions={pts}
            pathOptions={{ color: "#9ca3af", weight: 3, opacity: 0.82, dashArray: "7 5" }}
          />
        ))}

        {/* Turbine markers — canvas fallback at low zoom */}
        {useCanvas
          ? mappable.map((loc) => (
              <CanvasMarker
                key={loc.locationId || loc.name}
                loc={loc}
                dimmed={dimmedIds.has(loc.locationId || loc.name)}
              />
            ))
          : mappable.map((loc) => (
              <TurbineMarker
                key={loc.locationId || loc.name}
                loc={loc}
                dimmed={dimmedIds.has(loc.locationId || loc.name)}
              />
            ))}

        {/* Vessel markers */}
        {showVessels && VESSELS.map((v) => <VesselMarker key={v.id} v={v} />)}

        <Legend
          showVessels={showVessels}
          onToggleVessels={toggleVessels}
          selectedDate={selectedDate}
          activeCableTypes={activeCableTypes}
          onToggleCableType={toggleCableType}
        />
      </MapContainer>

      {/* Loading overlay (sheet data OR GeoJSON) */}
      {(isLoading || cableGeoQuery.isLoading) && (
        <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none z-[999]">
          <div
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: "rgba(12,60,96,0.92)", color: "#c8d4e0" }}
          >
            {cableGeoQuery.isLoading ? "Loading cable geometry…" : "Fetching live data…"}
          </div>
        </div>
      )}

      <div
        className="absolute top-3 right-3 z-[999] text-[10px] px-2 py-1 rounded"
        style={{
          background: "rgba(12,60,96,0.88)",
          color: "#8ba8c0",
          border: "1px solid rgba(255,255,255,0.08)",
          pointerEvents: "none",
        }}
      >
        {mappable.length} locations · CVOW1
        {cableGeoQuery.data && (
          <span className="ml-1.5 opacity-60">
            · {interArray.length + stringFeeder.length} cables
          </span>
        )}
      </div>
    </div>
  );
});
