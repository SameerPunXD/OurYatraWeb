import { useEffect, useMemo, useRef, useState } from "react";
import { getDrivingRoutePath, hasGoogleMapsApiKey, loadGoogleMaps } from "@/lib/googleMaps";

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

const pickupIconUrl = "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
const dropoffIconUrl = "https://maps.google.com/mapfiles/ms/icons/red-dot.png";
const driverIconUrl = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";
const kathmanduCenter = { lat: 27.7172, lng: 85.324 };

const RideMap = ({ pickup, dropoff, driverLocation, onMapClick, selectingFor, userLocation }: RideMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const markerRefs = useRef<{
    pickup: google.maps.Marker | null;
    dropoff: google.maps.Marker | null;
    driver: google.maps.Marker | null;
  }>({
    pickup: null,
    dropoff: null,
    driver: null,
  });
  const [loadError, setLoadError] = useState<string | null>(null);

  const defaultCenter = useMemo(
    () => userLocation || pickup || dropoff || driverLocation || kathmanduCenter,
    [driverLocation, dropoff, pickup, userLocation],
  );

  useEffect(() => {
    let cancelled = false;

    const initializeMap = async () => {
      if (!hasGoogleMapsApiKey()) {
        setLoadError("Google Maps API key missing. Please set VITE_GOOGLE_MAPS_API_KEY.");
        return;
      }

      try {
        const googleMaps = await loadGoogleMaps();
        if (cancelled || !containerRef.current || mapRef.current) {
          return;
        }

        mapRef.current = new googleMaps.maps.Map(containerRef.current, {
          center: defaultCenter,
          zoom: 13,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
      } catch (error) {
        setLoadError((error as Error).message || "Could not load Google Maps.");
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
      clickListenerRef.current?.remove();
      routePolylineRef.current?.setMap(null);
      Object.values(markerRefs.current).forEach((marker) => marker?.setMap(null));
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) {
      return;
    }

    clickListenerRef.current?.remove();

    if (!selectingFor) {
      return;
    }

    clickListenerRef.current = map.addListener("click", (event) => {
      if (!event.latLng) {
        return;
      }

      onMapClick({
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      });
    });

    return () => clickListenerRef.current?.remove();
  }, [onMapClick, selectingFor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) {
      return;
    }

    const syncMarker = (
      key: keyof typeof markerRefs.current,
      position: LatLng | null,
      iconUrl: string,
      title: string,
    ) => {
      const existingMarker = markerRefs.current[key];

      if (!position) {
        existingMarker?.setMap(null);
        markerRefs.current[key] = null;
        return;
      }

      if (!existingMarker) {
        markerRefs.current[key] = new google.maps.Marker({
          map,
          position,
          title,
          icon: iconUrl,
        });
        return;
      }

      existingMarker.setMap(map);
      existingMarker.setPosition(position);
    };

    syncMarker("pickup", pickup, pickupIconUrl, "Pickup");
    syncMarker("dropoff", dropoff, dropoffIconUrl, "Destination");
    syncMarker("driver", driverLocation, driverIconUrl, "Driver");
  }, [driverLocation, dropoff, pickup]);

  useEffect(() => {
    let cancelled = false;

    const updateViewportAndRoute = async () => {
      const map = mapRef.current;
      if (!map || !window.google?.maps) {
        return;
      }

      routePolylineRef.current?.setMap(null);
      routePolylineRef.current = null;

      const bounds = new google.maps.LatLngBounds();
      const viewportPoints: LatLng[] = [];

      if (pickup) viewportPoints.push(pickup);
      if (dropoff) viewportPoints.push(dropoff);
      if (driverLocation) viewportPoints.push(driverLocation);

      if (pickup && dropoff) {
        const routePath = await getDrivingRoutePath(pickup, dropoff);

        if (cancelled) {
          return;
        }

        if (routePath && routePath.length > 1) {
          routePolylineRef.current = new google.maps.Polyline({
            map,
            path: routePath,
            strokeColor: "#dc2626",
            strokeOpacity: 1,
            strokeWeight: 4,
          });

          routePath.forEach((point) => bounds.extend(point));
        }
      }

      viewportPoints.forEach((point) => bounds.extend(point));

      if (viewportPoints.length > 1) {
        map.fitBounds(bounds, 60);
        return;
      }

      if (viewportPoints.length === 1) {
        map.setCenter(viewportPoints[0]);
        map.setZoom(15);
        return;
      }

      if (userLocation) {
        map.setCenter(userLocation);
        map.setZoom(14);
        return;
      }

      map.setCenter(defaultCenter);
      map.setZoom(13);
    };

    updateViewportAndRoute();

    return () => {
      cancelled = true;
    };
  }, [defaultCenter, driverLocation, dropoff, pickup, userLocation]);

  return (
    <div className="relative h-full w-full">
      {selectingFor && (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur">
          Tap on map to set {selectingFor === "pickup" ? "pickup 📍" : "destination 🏁"}
        </div>
      )}

      {loadError ? (
        <div className="min-h-[300px] rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : (
        <div ref={containerRef} className="h-full min-h-[300px] w-full rounded-xl" />
      )}
    </div>
  );
};

export default RideMap;
