import { memo, useMemo, useState, useCallback } from "react";
import {
  MapContainer, TileLayer, Popup,
  Polyline, Marker, CircleMarker, useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSheetData } from "@/context/SheetDataContext";
import { useMapTab } from "@/context/MapTabContext";
import { statusColor } from "@/lib/types";
import type { Location } from "@/lib/types";

const CVOW_CENTER: [number, number] = [36.87, -75.50];
const ZOOM = 10;
const CANVAS_ZOOM_THRESHOLD = 9;
const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors &copy; <a href="https://carto.com">CARTO</a>';

const canvasRenderer = L.canvas({ padding: 0.5 });

/* Virginia Beach landfall waypoint — the export cable converges here */
const VB_LANDFALL: [number, number] = [36.918, -75.995];

/* Intermediate waypoints between farm and shore */
const EXPORT_MID: [number, number][] = [
  [36.968, -75.556],
  [36.962, -75.610],
  [36.954, -75.668],
  [36.945, -75.730],
  [36.937, -75.790],
  [36.930, -75.850],
  [36.924, -75.910],
  [36.920, -75.960],
  VB_LANDFALL,
];

/* Stable per-string colour palette (12 colours, wraps for large arrays) */
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
}

const IS_SUBSTATION = (lt: string) =>
  lt === "Substation" || lt === "HV Station" || lt === "Offshore Substation";

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

/* ─── Icon factories ─────────────────────────────────── */

function createTurbineIcon(status: string, isSubstation: boolean, label: string): L.DivIcon {
  const color = statusColor(status);
  const size = isSubstation ? 32 : 22;
  const c = size / 2;
  const r = c - 1.5;
  const bladeEnd = -(r - 5);
  const labelY = size + 9;
  const totalH = size + 12;

  const html = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${totalH}" viewBox="0 0 ${size} ${totalH}">
    <circle cx="${c}" cy="${c}" r="${r}" fill="#cfd4da" stroke="${color}" stroke-width="2.2"/>
    <g transform="translate(${c},${c})" opacity="0.52">
      <line x1="0" y1="${bladeEnd}" x2="0" y2="-2.5" stroke="#455060" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="0" y1="${bladeEnd}" x2="0" y2="-2.5" stroke="#455060" stroke-width="1.4" stroke-linecap="round" transform="rotate(120)"/>
      <line x1="0" y1="${bladeEnd}" x2="0" y2="-2.5" stroke="#455060" stroke-width="1.4" stroke-linecap="round" transform="rotate(240)"/>
    </g>
    <circle cx="${c}" cy="${c}" r="2.4" fill="#455060" opacity="0.9"/>
    <text x="${c}" y="${labelY}" text-anchor="middle"
      font-size="${isSubstation ? 8 : 7}" font-family="Poppins,Arial,sans-serif"
      fill="#2c3e50" font-weight="600" letter-spacing="0.2">${label}</text>
  </svg>`;

  return L.divIcon({
    html,
    className: "",
    iconSize: [size, totalH],
    iconAnchor: [c, c],
    popupAnchor: [0, -(c + 2)],
  });
}

function createVesselIcon(hdg: number): L.DivIcon {
  const html = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="17" viewBox="0 0 13 17" style="transform:rotate(${hdg}deg);transform-origin:6.5px 8.5px;display:block">
    <polygon points="6.5,1 12,15 6.5,11.5 1,15" fill="#3d5a9e" stroke="rgba(255,255,255,0.7)" stroke-width="0.6" opacity="0.92"/>
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

/* ─── Legend + vessel toggle ─────────────────────────── */

function Legend({
  showVessels, onToggleVessels, selectedDate,
}: {
  showVessels: boolean;
  onToggleVessels: () => void;
  selectedDate: Date | null;
}) {
  const items = [
    { label: "Completed",   color: "#22c55e" },
    { label: "In Progress", color: "#52A8EC" },
    { label: "New",         color: "#94a3b8" },
    { label: "Excluded",    color: "#9ca3af" },
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
          {items.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2 py-0.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span style={{ color: "#c8d4e0" }}>{label}</span>
            </div>
          ))}
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
        <div className="leaflet-control m-3">
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
        </div>
      </div>
    </>
  );
}

/* ─── Main MapView ───────────────────────────────────── */

export default memo(function MapView() {
  const { locations, campaigns, cables, stringDefs, locationByName, isLoading } = useSheetData();
  const { activeTab, selectedDate, selectedString } = useMapTab();
  const [showVessels, setShowVessels] = useState(true);
  const [mapZoom, setMapZoom] = useState(ZOOM);
  const toggleVessels = useCallback(() => setShowVessels((v) => !v), []);

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

  /* Campaign-date driven dim set (unchanged) */
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

  /**
   * Cable polylines — one multi-segment Polyline per string, built by
   * walking the Cable sheet topology chain (Location_A → Location_B) starting
   * from each string's String_Starting_Location.
   *
   * For each string:
   *   1. Collect all cables whose stringLink matches.
   *   2. Build a bidirectional adjacency map between location names.
   *   3. Walk from startingLocation, always moving to the unvisited neighbour.
   *   4. When the next node is a substation, emit the path so far as the
   *      inter-array polyline and the final edge as the string-feeder.
   *
   * Falls back to orderOfMarch-ordered multi-point polylines per string when
   * the Cable topology produces nothing (e.g. data not yet loaded).
   */
  const { interArray, stringFeeder } = useMemo((): {
    interArray: CableSeg[];
    stringFeeder: CableSeg[];
  } => {
    if (showExportOnly) return { interArray: [], stringFeeder: [] };

    const ia: CableSeg[] = [];
    const sf: CableSeg[] = [];

    /* ── Build lookup: stringName → StringDef ── */
    const stringDefByName = new Map<string, { startingLocation: string }>();
    for (const sd of stringDefs) {
      if (sd.stringName) stringDefByName.set(sd.stringName, sd);
    }

    /* ── Group cables by stringLink ── */
    const cablesByString = new Map<string, typeof cables>();
    for (const cable of cables) {
      if (!cable.stringLink) continue;
      const arr = cablesByString.get(cable.stringLink) ?? [];
      arr.push(cable);
      cablesByString.set(cable.stringLink, arr);
    }

    /* ── Distinct strings present in the visible mappable set ── */
    const visibleStrings = Array.from(
      new Set(mappable.filter((l) => l.string && !IS_SUBSTATION(l.locationType)).map((l) => l.string)),
    );

    let topologyResolved = 0;

    for (const stringName of visibleStrings) {
      const color = stringColorMap.get(stringName) ?? "#6b8aad";
      const stringCables = cablesByString.get(stringName) ?? [];
      if (stringCables.length === 0) continue;

      /* Build bidirectional adjacency for this string's cables */
      const adj = new Map<string, string[]>();
      for (const cable of stringCables) {
        if (!cable.locationA || !cable.locationB) continue;
        const aNeighbours = adj.get(cable.locationA) ?? [];
        aNeighbours.push(cable.locationB);
        adj.set(cable.locationA, aNeighbours);

        const bNeighbours = adj.get(cable.locationB) ?? [];
        bNeighbours.push(cable.locationA);
        adj.set(cable.locationB, bNeighbours);
      }

      /* Determine walk start: prefer StringDef.startingLocation, else any
         node in the adjacency that has only one neighbour (a chain endpoint) */
      const sdStart = stringDefByName.get(stringName)?.startingLocation;
      let walkStart: string | undefined = sdStart && adj.has(sdStart) ? sdStart : undefined;
      if (!walkStart) {
        for (const [node, neighbours] of adj) {
          if (neighbours.length === 1) { walkStart = node; break; }
        }
      }
      if (!walkStart) continue;

      /* Walk the chain */
      const visited = new Set<string>();
      let current = walkStart;
      visited.add(current);

      const interPts: [number, number][] = [];
      const startLoc = locationByName.get(current);
      if (startLoc?.latLng) interPts.push(startLoc.latLng);

      const MAX_ITER = 200;
      let iter = 0;

      while (iter++ < MAX_ITER) {
        const neighbours = adj.get(current) ?? [];
        const next = neighbours.find((n) => !visited.has(n));
        if (!next) break;

        visited.add(next);
        const nextLoc = locationByName.get(next);
        if (!nextLoc?.latLng) { current = next; continue; }

        if (IS_SUBSTATION(nextLoc.locationType)) {
          /* Last inter-array point already in interPts — emit string-feeder */
          const lastPt = interPts[interPts.length - 1];
          if (lastPt) {
            sf.push({
              key: `sf-${stringName}`,
              pts: [lastPt, nextLoc.latLng],
              color,
              kind: "string-feeder",
            });
          }
          break;
        }

        interPts.push(nextLoc.latLng);
        current = next;
      }

      if (interPts.length >= 2) {
        ia.push({ key: `ia-${stringName}`, pts: interPts, color, kind: "inter-array" });
        topologyResolved++;
      }
    }

    /**
     * Fallback — fires only when the topology walk produced nothing
     * (cables not yet loaded / all stringLink values missing).
     * Builds one multi-point Polyline per string sorted by orderOfMarch.
     */
    if (topologyResolved === 0) {
      const stringMap = new Map<string, Location[]>();
      for (const loc of mappable) {
        if (!loc.string || !loc.latLng || IS_SUBSTATION(loc.locationType)) continue;
        const arr = stringMap.get(loc.string) ?? [];
        arr.push(loc);
        stringMap.set(loc.string, arr);
      }
      for (const [sid, locs] of stringMap) {
        const sorted = [...locs].sort(
          (a, b) => (parseFloat(a.orderOfMarch) || 0) - (parseFloat(b.orderOfMarch) || 0),
        );
        const color = stringColorMap.get(sid) ?? "#6b8aad";
        const pts = sorted.filter((l) => l.latLng).map((l) => l.latLng as [number, number]);
        if (pts.length >= 2) ia.push({ key: `fb-${sid}`, pts, color, kind: "inter-array" });
      }
    }

    return { interArray: ia, stringFeeder: sf };
  }, [cables, stringDefs, mappable, locationByName, stringColorMap, showExportOnly]);

  /**
   * Export cables — drawn from each substation's actual position.
   * Resolves against the *full* locations array (not just the tab-filtered
   * mappable set) so export cables always show on the export tab.
   * Falls back to a single hardcoded route if no substation has a latLng.
   */
  const exportCables = useMemo(() => {
    const substations = locations.filter(
      (l) => IS_SUBSTATION(l.locationType) && l.latLng,
    );
    if (substations.length === 0) {
      const fallbackStart: [number, number] = [36.972, -75.519];
      return [{ key: "export-default", pts: [fallbackStart, ...EXPORT_MID] }];
    }
    return substations.map((sub) => ({
      key: `export-${sub.name}`,
      pts: [sub.latLng!, ...EXPORT_MID] as [number, number][],
    }));
  }, [locations]);

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

        {/* 1 · Inter-array cables — thin, per-string colour */}
        {interArray.map(({ key, pts, color }) => (
          <Polyline
            key={key}
            positions={pts}
            pathOptions={{ color, weight: 1.5, opacity: 0.7 }}
          />
        ))}

        {/* 2 · String-feeder cables — thicker, same per-string colour */}
        {stringFeeder.map(({ key, pts, color }) => (
          <Polyline
            key={key}
            positions={pts}
            pathOptions={{ color, weight: 3, opacity: 0.9 }}
          />
        ))}

        {/* 3 · Export / main cables — thick dashed grey, one per substation */}
        {exportCables.map(({ key, pts }) => (
          <Polyline
            key={key}
            positions={pts}
            pathOptions={{ color: "#9ca3af", weight: 3, opacity: 0.8, dashArray: "7 5" }}
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
        />
      </MapContainer>

      {isLoading && (
        <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none z-[999]">
          <div
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: "rgba(12,60,96,0.92)", color: "#c8d4e0" }}
          >
            Fetching live data…
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
      </div>
    </div>
  );
});
