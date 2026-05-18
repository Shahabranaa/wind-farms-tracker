import { memo, useMemo, useState, useCallback } from "react";
import { MapContainer, TileLayer, Popup, Polyline, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSheetData } from "@/context/SheetDataContext";
import { useMapTab } from "@/context/MapTabContext";
import { statusColor } from "@/lib/types";
import type { Location } from "@/lib/types";

const CVOW_CENTER: [number, number] = [36.87, -75.50];
const ZOOM = 10;
const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors &copy; <a href="https://carto.com">CARTO</a>';

const EXPORT_CABLE: [number, number][] = [
  [36.972, -75.519],
  [36.968, -75.556],
  [36.962, -75.610],
  [36.954, -75.668],
  [36.945, -75.730],
  [36.937, -75.790],
  [36.930, -75.850],
  [36.924, -75.910],
  [36.920, -75.960],
  [36.918, -75.995],
];

interface VesselDef {
  id: number;
  pos: [number, number];
  hdg: number;
  name: string;
  type: string;
}

const VESSELS: VesselDef[] = [
  { id: 1,  pos: [37.060, -75.340], hdg: 195, name: "GENESIS VENTURE",    type: "Construction" },
  { id: 2,  pos: [36.985, -75.270], hdg: 140, name: "ACTA CENTAURUS",     type: "Survey" },
  { id: 3,  pos: [37.120, -75.520], hdg: 220, name: "NDURANCE",           type: "Cable-lay" },
  { id: 4,  pos: [36.840, -75.440], hdg: 30,  name: "BRAVE TERN",         type: "Installation" },
  { id: 5,  pos: [36.920, -75.200], hdg: 270, name: "ORION",              type: "Heavy-lift" },
  { id: 6,  pos: [37.180, -75.380], hdg: 160, name: "SEA INSTALLER",      type: "Installation" },
  { id: 7,  pos: [36.780, -75.300], hdg: 350, name: "PACIFIC CONSTRUCTOR", type: "Construction" },
  { id: 8,  pos: [36.870, -75.680], hdg: 85,  name: "SEAWAY STRASHNOV",   type: "Heavy-lift" },
  { id: 9,  pos: [37.040, -75.760], hdg: 10,  name: "SCALDIS ASSISTANT",  type: "Survey" },
  { id: 10, pos: [36.950, -75.830], hdg: 240, name: "CDFS PIONEER",       type: "Support" },
  { id: 11, pos: [37.200, -75.650], hdg: 315, name: "OLYMPIC TAURUS",     type: "Support" },
  { id: 12, pos: [36.720, -75.480], hdg: 60,  name: "VIDAR VIKING",       type: "Survey" },
  { id: 13, pos: [36.990, -75.950], hdg: 180, name: "STRIL MERKUR",       type: "Supply" },
  { id: 14, pos: [37.150, -75.200], hdg: 120, name: "ESVAGT CONNECTOR",   type: "Service" },
  { id: 15, pos: [36.660, -75.360], hdg: 45,  name: "CL PRESTIGE",        type: "Cargo" },
  { id: 16, pos: [37.080, -75.900], hdg: 280, name: "HAVILA JUPITER",     type: "Survey" },
  { id: 17, pos: [36.810, -75.820], hdg: 200, name: "NEXUS",              type: "Support" },
  { id: 18, pos: [37.250, -75.780], hdg: 100, name: "ISLAND CONSTRUCTOR", type: "Construction" },
  { id: 19, pos: [36.740, -75.620], hdg: 170, name: "HIGHLAND NAVIGATOR", type: "Supply" },
  { id: 20, pos: [37.010, -75.110], hdg: 230, name: "VOS SWEET",         type: "Service" },
];

function createTurbineIcon(status: string, isSubstation: boolean): L.DivIcon {
  const color = statusColor(status);
  const size = isSubstation ? 32 : 22;
  const c = size / 2;
  const r = c - 1.5;
  const bladeEnd = -(r - 5);
  const opacity = status === "Excluded" ? 0.3 : 0.92;

  const html = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${c}" cy="${c}" r="${r}" fill="#cfd4da" stroke="${color}" stroke-width="2.2" opacity="${opacity}"/>
    <g transform="translate(${c},${c})" opacity="0.52">
      <line x1="0" y1="${bladeEnd}" x2="0" y2="-2.5" stroke="#455060" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="0" y1="${bladeEnd}" x2="0" y2="-2.5" stroke="#455060" stroke-width="1.4" stroke-linecap="round" transform="rotate(120)"/>
      <line x1="0" y1="${bladeEnd}" x2="0" y2="-2.5" stroke="#455060" stroke-width="1.4" stroke-linecap="round" transform="rotate(240)"/>
    </g>
    <circle cx="${c}" cy="${c}" r="2.4" fill="#455060" opacity="${opacity}"/>
  </svg>`;

  return L.divIcon({
    html,
    className: "",
    iconSize: [size, size],
    iconAnchor: [c, c],
    popupAnchor: [0, -(c + 2)],
  });
}

function createVesselIcon(hdg: number): L.DivIcon {
  const html = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="17" viewBox="0 0 13 17" style="transform:rotate(${hdg}deg);transform-origin:6.5px 8.5px;display:block">
    <polygon points="6.5,1 12,15 6.5,11.5 1,15" fill="#3d5a9e" stroke="rgba(255,255,255,0.7)" stroke-width="0.6" opacity="0.92"/>
  </svg>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [13, 17],
    iconAnchor: [6, 8],
    popupAnchor: [0, -10],
  });
}

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
        {loc.orderOfMarch && <><span className="text-muted-foreground">Order</span><span>{loc.orderOfMarch}</span></>}
        {loc.allocatedHours != null && <><span className="text-muted-foreground">Alloc. hrs</span><span>{loc.allocatedHours}</span></>}
      </div>
    </div>
  );
}

const TurbineMarker = memo(function TurbineMarker({ loc }: { loc: Location }) {
  if (!loc.latLng) return null;
  const isSub = loc.locationType === "Substation" || loc.locationType === "HV Station";
  const icon = useMemo(() => createTurbineIcon(loc.progressStatus, isSub), [loc.progressStatus, isSub]);
  return (
    <Marker position={loc.latLng} icon={icon}>
      <Popup maxWidth={280}>
        <LocationPopup loc={loc} />
      </Popup>
    </Marker>
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

function Legend({ showVessels, onToggleVessels }: { showVessels: boolean; onToggleVessels: () => void }) {
  const items = [
    { label: "Completed",   color: "#22c55e" },
    { label: "In Progress", color: "#52A8EC" },
    { label: "New",         color: "#94a3b8" },
    { label: "Excluded",    color: "#9ca3af" },
  ];
  return (
    <>
      <div className="leaflet-bottom leaflet-right" style={{ pointerEvents: "none", zIndex: 1000 }}>
        <div
          className="leaflet-control m-3 px-3 py-2 rounded text-xs"
          style={{ background: "rgba(12,60,96,0.92)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {items.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2 py-0.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span style={{ color: "#c8d4e0" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: "auto", zIndex: 1000 }}>
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

export default memo(function MapView() {
  const { locations, isLoading } = useSheetData();
  const { activeTab } = useMapTab();
  const [showVessels, setShowVessels] = useState(true);
  const toggleVessels = useCallback(() => setShowVessels((v) => !v), []);

  const showExportOnly = activeTab === "export";

  const mappable = useMemo(() => {
    const withPos = locations.filter((l) => l.latLng !== null);
    if (showExportOnly) return [];
    if (activeTab === "all") return withPos;
    return withPos.filter((l) => l.primarySubStation === activeTab || l.primarySubStation.includes(activeTab));
  }, [locations, activeTab, showExportOnly]);

  const cablePolylines = useMemo(() => {
    if (showExportOnly) return [];
    const stringMap = new Map<string, Location[]>();
    for (const loc of mappable) {
      if (!loc.string) continue;
      const arr = stringMap.get(loc.string) ?? [];
      arr.push(loc);
      stringMap.set(loc.string, arr);
    }
    return Array.from(stringMap.entries())
      .map(([stringId, locs]) => {
        const sorted = [...locs].sort(
          (a, b) => (parseFloat(a.orderOfMarch) || 0) - (parseFloat(b.orderOfMarch) || 0),
        );
        return {
          stringId,
          points: sorted.map((l) => l.latLng!).filter(Boolean) as [number, number][],
        };
      })
      .filter((g) => g.points.length >= 2);
  }, [mappable, showExportOnly]);

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

        {/* Inter-array cables */}
        {cablePolylines.map(({ stringId, points }) => (
          <Polyline
            key={`iac-${stringId}`}
            positions={points}
            pathOptions={{ color: "#9ca3af", weight: 2, opacity: 0.75 }}
          />
        ))}

        {/* Export cable */}
        <Polyline
          positions={EXPORT_CABLE}
          pathOptions={{ color: "#6b7280", weight: 3, opacity: 0.8, dashArray: "6 4" }}
        />

        {/* Turbine markers */}
        {mappable.map((loc) => (
          <TurbineMarker key={loc.locationId || loc.name} loc={loc} />
        ))}

        {/* Vessel markers */}
        {showVessels && VESSELS.map((v) => (
          <VesselMarker key={v.id} v={v} />
        ))}

        <Legend showVessels={showVessels} onToggleVessels={toggleVessels} />
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
