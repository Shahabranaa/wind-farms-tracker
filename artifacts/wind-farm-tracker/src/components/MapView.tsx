import { memo, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSheetData } from "@/context/SheetDataContext";
import { statusColor } from "@/lib/types";
import type { Location } from "@/lib/types";

const CVOW_CENTER: [number, number] = [36.87, -75.36];
const ZOOM = 11;
const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://carto.com">CARTO</a>';

const canvasRenderer = L.canvas({ padding: 0.5 });

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

const LocationMarker = memo(function LocationMarker({ loc }: { loc: Location }) {
  if (!loc.latLng) return null;
  const color = statusColor(loc.progressStatus);
  return (
    <CircleMarker
      center={loc.latLng}
      radius={loc.locationType === "Substation" || loc.locationType === "HV Station" ? 9 : 6}
      renderer={canvasRenderer}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: loc.progressStatus === "Excluded" ? 0.25 : 0.85,
        weight: loc.progressStatus === "Excluded" ? 0.5 : 1.5,
      }}
    >
      <Popup maxWidth={280}>
        <LocationPopup loc={loc} />
      </Popup>
    </CircleMarker>
  );
});

function Legend() {
  const items = [
    { label: "Completed", color: "#22c55e" },
    { label: "In Progress", color: "#52A8EC" },
    { label: "New", color: "#94a3b8" },
    { label: "Excluded", color: "#475569" },
  ];
  return (
    <div
      className="leaflet-bottom leaflet-right"
      style={{ pointerEvents: "none", zIndex: 1000 }}
    >
      <div
        className="leaflet-control m-3 px-3 py-2 rounded text-xs"
        style={{ background: "hsl(207 79% 22% / 0.92)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {items.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2 py-0.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            <span style={{ color: "hsl(213 27% 84%)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingOverlay() {
  const map = useMap();
  void map;
  return null;
}

export default memo(function MapView() {
  const { locations, isLoading } = useSheetData();

  const mappable = useMemo(
    () => locations.filter((l) => l.latLng !== null),
    [locations],
  );

  return (
    <div className="relative flex-1 h-full">
      <MapContainer
        center={CVOW_CENTER}
        zoom={ZOOM}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        preferCanvas={true}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        <LoadingOverlay />
        {mappable.map((loc) => (
          <LocationMarker key={loc.locationId || loc.name} loc={loc} />
        ))}
        <Legend />
      </MapContainer>

      {isLoading && (
        <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none z-[999]">
          <div
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: "hsl(207 79% 22% / 0.9)", color: "hsl(213 27% 84%)" }}
          >
            Fetching live data…
          </div>
        </div>
      )}

      <div
        className="absolute top-3 right-3 z-[999] text-[10px] px-2 py-1 rounded"
        style={{
          background: "hsl(207 79% 22% / 0.85)",
          color: "hsl(214 17% 60%)",
          border: "1px solid rgba(255,255,255,0.08)",
          pointerEvents: "none",
        }}
      >
        {mappable.length} locations · CVOW1
      </div>
    </div>
  );
});
