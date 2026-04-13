import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface GooglePlaceSuggestion {
  description: string;
  placeId: string;
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

export const getDrivingRoutePath = async (origin: LatLngLiteral, destination: LatLngLiteral) => {
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
          travelMode: googleMaps.maps.TravelMode.DRIVING,
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

    const overviewPath = response.routes?.[0]?.overview_path || [];
    return overviewPath.map((point) => ({
      lat: point.lat(),
      lng: point.lng(),
    }));
  } catch {
    return null;
  }
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
