import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface GooglePlaceSuggestion {
  description: string;
  placeId: string;
}

interface RoutePathResult {
  path: LatLngLiteral[];
  distanceMeters: number;
}

const GOOGLE_MAPS_API_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
let optionsConfigured = false;

const ensureGoogleMapsOptions = () => {
  if (optionsConfigured || !GOOGLE_MAPS_API_KEY) return;

  setOptions({
    key: GOOGLE_MAPS_API_KEY,
    v: "weekly",
    language: "en",
    region: "NP",
  });

  optionsConfigured = true;
};

const ensureMapsLibrary = async () => {
  ensureGoogleMapsOptions();
  await importLibrary("maps");
  return google;
};

const ensurePlacesLibrary = async () => {
  ensureGoogleMapsOptions();
  await Promise.all([importLibrary("maps"), importLibrary("places")]);
  return google;
};

const ensureGeocodingLibrary = async () => {
  ensureGoogleMapsOptions();
  await Promise.all([importLibrary("maps"), importLibrary("geocoding")]);
  return google;
};

const ensureRoutesLibrary = async () => {
  ensureGoogleMapsOptions();
  await Promise.all([importLibrary("maps"), importLibrary("routes")]);
  return google;
};

const pinnedLocationFallback = (lat: number, lng: number) => `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
const getDistanceMeters = (from: LatLngLiteral, to: LatLngLiteral) => {
  const averageLatitude = (from.lat + to.lat) / 2;
  const east = (to.lng - from.lng) * 111320 * Math.cos((averageLatitude * Math.PI) / 180);
  const north = (to.lat - from.lat) * 111320;
  return Math.sqrt(east * east + north * north);
};

const getPathDistanceMeters = (path: LatLngLiteral[]) => {
  let totalDistance = 0;

  for (let index = 1; index < path.length; index += 1) {
    totalDistance += getDistanceMeters(path[index - 1], path[index]);
  }

  return totalDistance;
};

export const hasGoogleMapsApiKey = () => GOOGLE_MAPS_API_KEY.length > 0;

export const getGoogleMapsApiKey = () => GOOGLE_MAPS_API_KEY;

export const loadGoogleMaps = async () => {
  if (!hasGoogleMapsApiKey()) {
    throw new Error("Google Maps API key missing");
  }

  return ensureMapsLibrary();
};

export const reverseGeocodeLatLng = async (lat: number, lng: number) => {
  if (!hasGoogleMapsApiKey()) {
    return pinnedLocationFallback(lat, lng);
  }

  try {
    const googleMaps = await ensureGeocodingLibrary();
    const geocoder = new googleMaps.maps.Geocoder();
    const response = await geocoder.geocode({
      location: { lat, lng },
    });

    const result = response.results?.[0];
    return result?.formatted_address || pinnedLocationFallback(lat, lng);
  } catch {
    return pinnedLocationFallback(lat, lng);
  }
};

export const geocodePlaceId = async (placeId: string) => {
  if (!hasGoogleMapsApiKey()) {
    return null;
  }

  try {
    const googleMaps = await ensureGeocodingLibrary();
    const geocoder = new googleMaps.maps.Geocoder();
    const response = await geocoder.geocode({ placeId });
    const result = response.results?.[0];
    const location = result?.geometry?.location;

    if (!result || !location) {
      return null;
    }

    return {
      name: result.formatted_address || result.place_id || "",
      latlng: {
        lat: location.lat(),
        lng: location.lng(),
      },
    };
  } catch {
    return null;
  }
};

export const geocodeAddress = async (address: string) => {
  if (!hasGoogleMapsApiKey()) {
    return null;
  }

  const trimmed = address.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const googleMaps = await ensureGeocodingLibrary();
    const geocoder = new googleMaps.maps.Geocoder();
    const response = await geocoder.geocode({
      address: trimmed,
      region: "NP",
    });

    const result = response.results?.[0];
    const location = result?.geometry?.location;

    if (!result || !location) {
      return null;
    }

    return {
      name: result.formatted_address || trimmed,
      latlng: {
        lat: location.lat(),
        lng: location.lng(),
      },
    };
  } catch {
    return null;
  }
};

export const autocompletePlaces = async (query: string, proximity?: LatLngLiteral | null) => {
  if (!hasGoogleMapsApiKey()) {
    return [] as GooglePlaceSuggestion[];
  }

  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [] as GooglePlaceSuggestion[];
  }

  const googleMaps = await ensurePlacesLibrary();
  const service = new googleMaps.maps.places.AutocompleteService();

  const request: google.maps.places.AutocompletionRequest = {
    input: trimmed,
    componentRestrictions: { country: "np" },
  };

  if (proximity) {
    request.locationBias = {
      center: proximity,
      radius: 25000,
    };
  }

  const predictions = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
    service.getPlacePredictions(request, (results, status) => {
      if (status === googleMaps.maps.places.PlacesServiceStatus.OK && results) {
        resolve(results);
        return;
      }

      resolve([]);
    });
  });

  return predictions.map((prediction) => ({
    description: prediction.description,
    placeId: prediction.place_id,
  }));
};

const requestRoutePath = async (
  origin: LatLngLiteral,
  destination: LatLngLiteral,
  travelMode: google.maps.TravelMode,
  provideRouteAlternatives = false,
) => {
  if (!hasGoogleMapsApiKey()) {
    return null;
  }

  try {
    const googleMaps = await ensureRoutesLibrary();
    const directionsService = new googleMaps.maps.DirectionsService();

    const response = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
      directionsService.route(
        {
          origin,
          destination,
          travelMode,
          provideRouteAlternatives,
        },
        (result, status) => {
          if (status === googleMaps.maps.DirectionsStatus.OK && result) {
            resolve(result);
            return;
          }

          reject(new Error(String(status)));
        },
      );
    });

    const bestRoute = (response.routes || [])
      .map((route) => {
        const path = (route.overview_path || []).map((point) => ({
          lat: point.lat(),
          lng: point.lng(),
        }));

        if (path.length < 2) {
          return null;
        }

        const legDistanceMeters = (route.legs || []).reduce(
          (totalDistance, leg) => totalDistance + (leg.distance?.value || 0),
          0,
        );

        return {
          path,
          distanceMeters: legDistanceMeters || getPathDistanceMeters(path),
        } satisfies RoutePathResult;
      })
      .filter((route): route is RoutePathResult => Boolean(route))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

    return bestRoute || null;
  } catch {
    return null;
  }
};

export const getDrivingRoutePath = async (origin: LatLngLiteral, destination: LatLngLiteral) => {
  const route = await requestRoutePath(
    origin,
    destination,
    google.maps.TravelMode.DRIVING,
    true,
  );

  return route?.path || null;
};

export const getPreviewRoutePath = async (origin: LatLngLiteral, destination: LatLngLiteral) => {
  const directDistanceMeters = getDistanceMeters(origin, destination);
  const drivingRoute = await requestRoutePath(
    origin,
    destination,
    google.maps.TravelMode.DRIVING,
    true,
  );

  if (!drivingRoute) {
    return null;
  }

  const shouldTryWalkingFallback = (
    directDistanceMeters > 120 &&
    directDistanceMeters < 3200 &&
    drivingRoute.distanceMeters > directDistanceMeters * 1.85
  );

  if (!shouldTryWalkingFallback) {
    return drivingRoute.path;
  }

  const walkingRoute = await requestRoutePath(
    origin,
    destination,
    google.maps.TravelMode.WALKING,
    true,
  );

  if (walkingRoute && walkingRoute.distanceMeters < drivingRoute.distanceMeters * 0.82) {
    return walkingRoute.path;
  }

  return drivingRoute.path;
};

export const buildGoogleStaticMapUrl = (driver?: LatLngLiteral | null, mechanic?: LatLngLiteral | null) => {
  if (!hasGoogleMapsApiKey() || !driver) {
    return "";
  }

  const params = new URLSearchParams({
    key: GOOGLE_MAPS_API_KEY,
    size: "700x280",
    scale: "2",
    maptype: "roadmap",
  });

  params.append("markers", `color:red|label:D|${driver.lat},${driver.lng}`);

  if (mechanic) {
    params.append("markers", `color:blue|label:G|${mechanic.lat},${mechanic.lng}`);
    params.append("path", `color:0x2563eb|weight:4|${driver.lat},${driver.lng}|${mechanic.lat},${mechanic.lng}`);
  }

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
};
