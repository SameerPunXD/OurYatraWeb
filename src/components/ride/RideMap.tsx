import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const dropoffIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const driverIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LatLng {
  lat: number;
  lng: number;
}

interface RideMapProps {
  pickup: LatLng | null;
  dropoff: LatLng | null;
  driverLocation: LatLng | null;
  onMapClick: (latlng: LatLng) => void;
  selectingFor: "pickup" | "dropoff" | null;
  userLocation: LatLng | null;
}

function FitBounds({ pickup, dropoff, userLocation }: { pickup: LatLng | null; dropoff: LatLng | null; userLocation: LatLng | null }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (pickup && dropoff) {
      const bounds = L.latLngBounds([pickup, dropoff]);
      map.fitBounds(bounds, { padding: [50, 50] });
      fitted.current = true;
    } else if (pickup && !fitted.current) {
      map.setView([pickup.lat, pickup.lng], 15);
    } else if (userLocation && !fitted.current) {
      map.setView([userLocation.lat, userLocation.lng], 14);
      fitted.current = true;
    }
  }, [pickup, dropoff, userLocation, map]);

  return null;
}

function MapClickHandler({ onMapClick, selectingFor }: { onMapClick: (latlng: LatLng) => void; selectingFor: "pickup" | "dropoff" | null }) {
  useMapEvents({
    click(e) {
      if (selectingFor) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

const RideMap = ({ pickup, dropoff, driverLocation, onMapClick, selectingFor, userLocation }: RideMapProps) => {
  const defaultCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [27.7172, 85.324]; // Kathmandu

  const mapboxPublicToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
  const lightStyleId = import.meta.env.VITE_MAPBOX_STYLE_ID || "mapbox/streets-v12";
  const darkStyleId = import.meta.env.VITE_MAPBOX_STYLE_DARK_ID || "mapbox/dark-v11";
  const [isDarkMap, setIsDarkMap] = useState(false);
  const mapboxStyleId = isDarkMap ? darkStyleId : lightStyleId;
  const tileUrl = `https://api.mapbox.com/styles/v1/${mapboxStyleId}/tiles/{z}/{x}/{y}?access_token=${mapboxPublicToken}`;
  const attribution = '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>';

  const [routePath, setRoutePath] = useState<[number, number][] | null>(null);

  useEffect(() => {
    const applyTheme = () => {
      const hasDarkClass = document.documentElement.classList.contains("dark");
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      setIsDarkMap(Boolean(hasDarkClass || prefersDark));
    };

    applyTheme();

    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", applyTheme);

    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", applyTheme);
    };
  }, []);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!pickup || !dropoff || !mapboxPublicToken) {
        setRoutePath(null);
        return;
      }

      try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?geometries=geojson&overview=full&alternatives=false&steps=false&access_token=${mapboxPublicToken}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("route request failed");

        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length > 1) {
          setRoutePath(coords.map((c: [number, number]) => [c[1], c[0]]));
        } else {
          setRoutePath(null);
        }
      } catch {
        setRoutePath(null);
      }
    };

    fetchRoute();
  }, [pickup, dropoff, mapboxPublicToken]);

  return (
    <div className="w-full h-full relative z-0">
      {selectingFor && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-card/95 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-border text-sm font-medium text-foreground">
          Tap on map to set {selectingFor === "pickup" ? "pickup 📍" : "destination 🏁"}
        </div>
      )}
      {!mapboxPublicToken ? (
        <div className="h-full min-h-[300px] rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Mapbox token missing. Please set <code>VITE_MAPBOX_PUBLIC_TOKEN</code>.
        </div>
      ) : (
      <MapContainer
        center={defaultCenter}
        zoom={13}
        className="w-full h-full rounded-xl"
        style={{ minHeight: "300px" }}
        zoomControl={false}
      >
        <TileLayer
          attribution={attribution}
          url={tileUrl}
          tileSize={512}
          zoomOffset={-1}
        />
        <MapClickHandler onMapClick={onMapClick} selectingFor={selectingFor} />
        <FitBounds pickup={pickup} dropoff={dropoff} userLocation={userLocation} />

        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
        {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}
        {driverLocation && <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} />}

        {pickup && dropoff && (
          <Polyline
            positions={routePath || [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]]}
            pathOptions={{ color: "hsl(0, 72%, 51%)", weight: 4 }}
          />
        )}
      </MapContainer>
      )}
    </div>
  );
};

export default RideMap;
