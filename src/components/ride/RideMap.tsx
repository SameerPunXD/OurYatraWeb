import { useEffect, useMemo, useRef, useState } from "react";
import bikeSpriteUrl from "../../../resources/Bike.png";
import carSpriteUrl from "../../../resources/Car.png";
import { getDrivingRoutePath, getPreviewRoutePath, hasGoogleMapsApiKey, loadGoogleMaps } from "@/lib/googleMaps";

interface LatLng {
  lat: number;
  lng: number;
}

interface PhantomVehicle {
  id: string;
  type: "car" | "bike";
  position: LatLng;
}

interface PhantomVehicleRuntime {
  marker: google.maps.Marker;
  id: string;
  type: PhantomVehicle["type"];
  requestedBasePosition: LatLng;
  routePath: LatLng[] | null;
  routeSegmentLengths: number[];
  routeLengthMeters: number;
  progressMeters: number;
  travelDirection: 1 | -1;
  speedMetersPerSecond: number;
  opacity: number;
  fadeDirection: -1 | 0 | 1;
  hiddenUntilSeconds: number | null;
  parked: boolean;
  routeRequestId: number;
  shouldRespawn: boolean;
  lastPosition: LatLng;
  lastHeadingDegrees: number;
  displayHeadingDegrees: number;
  lastIconKey: string | null;
}

interface RideMapProps {
  pickup: LatLng | null;
  dropoff: LatLng | null;
  driverLocation: LatLng | null;
  onMapClick: (latlng: LatLng) => void;
  selectingFor: "pickup" | "dropoff" | null;
  userLocation: LatLng | null;
  userLocationRadiusMeters?: number | null;
  phantomVehicles?: PhantomVehicle[];
}

interface PhantomVehicleIconSizing {
  drawWidth: number;
  drawHeight: number;
  canvasSize: number;
}

interface PhantomVehicleStretchConfig {
  widthAdjust: number;
  heightAdjust: number;
}

const pickupIconUrl = "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
const dropoffIconUrl = "https://maps.google.com/mapfiles/ms/icons/red-dot.png";
const driverIconUrl = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";
const kathmanduCenter = { lat: 27.7172, lng: 85.324 };
const defaultUserLocationRadius = 220;
const minimumUserLocationRadius = 120;
const maximumUserLocationRadius = 1200;
const baseMapZoom = 13;
const singlePointViewportZoom = 17;
const userLocationViewportZoom = 17;
const minimumPhantomStretchAdjust = -20;
const maximumPhantomStretchAdjust = 28;
const minimumPhantomDrawSize = 18;
const maximumPhantomDrawSize = 88;
const maximumPhantomCanvasSize = 124;
const parseNumberEnv = (value: unknown) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};
const clampPhantomStretchAdjust = (value: number) => (
  Math.min(Math.max(value, minimumPhantomStretchAdjust), maximumPhantomStretchAdjust)
);
const phantomVehicleSpriteConfig = {
  car: {
    imageUrl: carSpriteUrl,
    drawWidth: 36,
    drawHeight: 40,
    canvasSize: 60,
    rotationOffsetDegrees: 0,
  },
  bike: {
    imageUrl: bikeSpriteUrl,
    drawWidth: 38,
    drawHeight: 38,
    canvasSize: 56,
    rotationOffsetDegrees: 0,
  },
} as const;
const phantomVehicleStretchConfig: Record<PhantomVehicle["type"], PhantomVehicleStretchConfig> = {
  car: {
    widthAdjust: clampPhantomStretchAdjust(parseNumberEnv(import.meta.env.VITE_PHANTOM_CAR_WIDTH_ADJUST)),
    heightAdjust: clampPhantomStretchAdjust(parseNumberEnv(import.meta.env.VITE_PHANTOM_CAR_HEIGHT_ADJUST)),
  },
  bike: {
    widthAdjust: clampPhantomStretchAdjust(parseNumberEnv(import.meta.env.VITE_PHANTOM_BIKE_WIDTH_ADJUST)),
    heightAdjust: clampPhantomStretchAdjust(parseNumberEnv(import.meta.env.VITE_PHANTOM_BIKE_HEIGHT_ADJUST)),
  },
};
const phantomSpriteImageCache = new Map<PhantomVehicle["type"], Promise<HTMLImageElement>>();
const phantomSpriteElementCache = new Map<PhantomVehicle["type"], HTMLImageElement>();
const phantomSpriteIconCache = new Map<string, string>();

const clampUserLocationRadius = (radiusMeters?: number | null) => {
  if (!radiusMeters || Number.isNaN(radiusMeters)) {
    return defaultUserLocationRadius;
  }

  return Math.min(Math.max(radiusMeters, minimumUserLocationRadius), maximumUserLocationRadius);
};

const getViewportPointKey = (point: LatLng | null) => (
  point ? `${point.lat.toFixed(5)},${point.lng.toFixed(5)}` : "none"
);

const arePointsNearby = (a: LatLng | null, b: LatLng | null, thresholdMeters = 20) => {
  if (!a || !b) {
    return false;
  }

  const metersPerLat = 111320;
  const latitudeCos = Math.cos(((a.lat + b.lat) / 2 * Math.PI) / 180);
  const safeCos = Math.abs(latitudeCos) < 0.0001 ? 0.0001 : latitudeCos;
  const dx = (a.lng - b.lng) * metersPerLat * safeCos;
  const dy = (a.lat - b.lat) * metersPerLat;
  return Math.sqrt(dx * dx + dy * dy) <= thresholdMeters;
};

const metersToLat = (meters: number) => meters / 111320;

const metersToLng = (meters: number, latitude: number) => {
  const latitudeCos = Math.cos((latitude * Math.PI) / 180);
  const safeCos = Math.abs(latitudeCos) < 0.0001 ? 0.0001 : latitudeCos;
  return meters / (111320 * safeCos);
};

const normalizeDegrees = (degrees: number) => {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const quantizeDegrees = (degrees: number, step = 4) => Math.round(normalizeDegrees(degrees) / step) * step;
const interpolateDegrees = (fromDegrees: number, toDegrees: number, blendFactor: number) => {
  const normalizedBlendFactor = Math.min(Math.max(blendFactor, 0), 1);
  const delta = ((toDegrees - fromDegrees + 540) % 360) - 180;
  return normalizeDegrees(fromDegrees + delta * normalizedBlendFactor);
};

const getHeadingDegrees = (from: LatLng, to: LatLng) => {
  const averageLatitude = (from.lat + to.lat) / 2;
  const east = (to.lng - from.lng) * 111320 * Math.cos((averageLatitude * Math.PI) / 180);
  const north = (to.lat - from.lat) * 111320;
  return normalizeDegrees((Math.atan2(north, east) * 180) / Math.PI);
};

const getDistanceMeters = (from: LatLng, to: LatLng) => {
  const averageLatitude = (from.lat + to.lat) / 2;
  const east = (to.lng - from.lng) * 111320 * Math.cos((averageLatitude * Math.PI) / 180);
  const north = (to.lat - from.lat) * 111320;
  return Math.sqrt(east * east + north * north);
};

const hashVehicleId = (id: string) => Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);

const getHeadingVectorOffset = (point: LatLng, headingDegrees: number, distanceMeters: number) => {
  const headingRadians = (headingDegrees * Math.PI) / 180;
  const eastMeters = Math.cos(headingRadians) * distanceMeters;
  const northMeters = Math.sin(headingRadians) * distanceMeters;

  return {
    lat: point.lat + metersToLat(northMeters),
    lng: point.lng + metersToLng(eastMeters, point.lat),
  };
};

const buildFallbackPhantomRoute = (vehicle: PhantomVehicle) => {
  const seed = hashVehicleId(vehicle.id);
  const loopRadius = vehicle.type === "car" ? 26 : 20;
  const stretchRadius = vehicle.type === "car" ? 38 : 28;
  const baseHeading = normalizeDegrees((seed * 37) % 360);

  return [0, 55, 110, 180, 250, 305, 360].map((angleOffset) => {
    const headingRadians = ((baseHeading + angleOffset) * Math.PI) / 180;
    const northMeters = Math.sin(headingRadians) * loopRadius;
    const eastMeters = Math.cos(headingRadians) * stretchRadius;

    return {
      lat: vehicle.position.lat + metersToLat(northMeters),
      lng: vehicle.position.lng + metersToLng(eastMeters, vehicle.position.lat),
    };
  });
};

const getPathMetrics = (path: LatLng[]) => {
  const segmentLengths: number[] = [];
  let totalLength = 0;

  for (let index = 1; index < path.length; index += 1) {
    const segmentLength = getDistanceMeters(path[index - 1], path[index]);
    segmentLengths.push(segmentLength);
    totalLength += segmentLength;
  }

  return {
    segmentLengths,
    totalLength,
  };
};

const getNearestDistanceToPath = (point: LatLng, path: LatLng[]) => {
  let nearestDistance = Number.POSITIVE_INFINITY;

  path.forEach((pathPoint) => {
    nearestDistance = Math.min(nearestDistance, getDistanceMeters(point, pathPoint));
  });

  return nearestDistance;
};

const getInterpolatedPathPoint = (path: LatLng[], segmentLengths: number[], distanceMeters: number) => {
  if (path.length <= 1) {
    return path[0] || null;
  }

  let traversedMeters = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    const nextTraversedMeters = traversedMeters + segmentLength;

    if (distanceMeters <= nextTraversedMeters || index === segmentLengths.length - 1) {
      const startPoint = path[index];
      const endPoint = path[index + 1];
      const segmentProgress = segmentLength <= 0 ? 0 : (distanceMeters - traversedMeters) / segmentLength;

      return {
        lat: startPoint.lat + (endPoint.lat - startPoint.lat) * segmentProgress,
        lng: startPoint.lng + (endPoint.lng - startPoint.lng) * segmentProgress,
      };
    }

    traversedMeters = nextTraversedMeters;
  }

  return path[path.length - 1];
};

const getPathTangentHeading = (
  path: LatLng[],
  segmentLengths: number[],
  distanceMeters: number,
  direction: 1 | -1,
) => {
  if (path.length <= 1) {
    return 0;
  }

  const sampleDistance = 8;
  const totalLength = segmentLengths.reduce((sum, segmentLength) => sum + segmentLength, 0);
  const fromDistance = direction === 1
    ? Math.max(0, distanceMeters - sampleDistance)
    : Math.min(totalLength, distanceMeters + sampleDistance);
  const toDistance = direction === 1
    ? Math.min(totalLength, distanceMeters + sampleDistance)
    : Math.max(0, distanceMeters - sampleDistance);
  const fromPoint = getInterpolatedPathPoint(path, segmentLengths, fromDistance) || path[0];
  const toPoint = getInterpolatedPathPoint(path, segmentLengths, toDistance) || path[path.length - 1];

  return getHeadingDegrees(fromPoint, toPoint);
};

const getPhantomRouteCandidates = (vehicle: PhantomVehicle) => {
  const seed = hashVehicleId(vehicle.id);
  const baseHeading = (seed * 41) % 360;
  const mainDistance = vehicle.type === "car" ? 180 + (seed % 40) : 130 + (seed % 35);
  const shortDistance = Math.round(mainDistance * 0.72);
  const headingCandidates = [
    baseHeading,
    normalizeDegrees(baseHeading + 55),
    normalizeDegrees(baseHeading - 55),
  ];

  return headingCandidates.flatMap((headingDegrees, index) => {
    const distance = index === 0 ? mainDistance : shortDistance;
    return [
      {
        origin: getHeadingVectorOffset(vehicle.position, headingDegrees + 180, distance / 2),
        destination: getHeadingVectorOffset(vehicle.position, headingDegrees, distance / 2),
      },
    ];
  });
};

const createParkedRuntime = (
  vehicle: PhantomVehicle,
  map: google.maps.Map,
  zoomLevel = baseMapZoom,
) => {
  const seed = hashVehicleId(vehicle.id);
  const headingDegrees = (seed % 2 === 0 ? 0 : 180);
  const { iconKey, icon } = getPhantomVehicleIcon(vehicle.type, headingDegrees, zoomLevel);

  return {
    marker: new google.maps.Marker({
      map,
      position: vehicle.position,
      title: vehicle.type === "car" ? "Nearby car" : "Nearby bike",
      icon,
      zIndex: 5,
      opacity: 0.92,
    }),
    id: vehicle.id,
    type: vehicle.type,
    requestedBasePosition: vehicle.position,
    routePath: null,
    routeSegmentLengths: [],
    routeLengthMeters: 0,
    progressMeters: 0,
    travelDirection: seed % 2 === 0 ? 1 : -1,
    speedMetersPerSecond: vehicle.type === "car" ? 3.1 + (seed % 4) * 0.32 : 2.7 + (seed % 4) * 0.24,
    opacity: 0.92,
    fadeDirection: 0,
    hiddenUntilSeconds: null,
    parked: true,
    routeRequestId: 0,
    shouldRespawn: seed % 3 === 0,
    lastPosition: vehicle.position,
    lastHeadingDegrees: headingDegrees,
    displayHeadingDegrees: headingDegrees,
    lastIconKey: iconKey,
  } satisfies PhantomVehicleRuntime;
};

const getPhantomZoomScale = (zoomLevel = baseMapZoom) => {
  const scale = 1 + (zoomLevel - baseMapZoom) * 0.15;
  return Math.min(Math.max(scale, 0.9), 1.55);
};

const getPhantomVehicleSizing = (
  type: PhantomVehicle["type"],
  zoomLevel = baseMapZoom,
): PhantomVehicleIconSizing => {
  const config = phantomVehicleSpriteConfig[type];
  const stretchConfig = phantomVehicleStretchConfig[type];
  const scale = getPhantomZoomScale(zoomLevel);
  const baseWidth = Math.min(
    maximumPhantomDrawSize,
    Math.max(minimumPhantomDrawSize, config.drawWidth + stretchConfig.widthAdjust),
  );
  const baseHeight = Math.min(
    maximumPhantomDrawSize,
    Math.max(minimumPhantomDrawSize, config.drawHeight + stretchConfig.heightAdjust),
  );
  const baseCanvasSize = Math.max(
    Math.max(baseWidth, baseHeight) + 18,
    config.canvasSize + Math.max(stretchConfig.widthAdjust, stretchConfig.heightAdjust),
  );

  return {
    drawWidth: Math.min(maximumPhantomDrawSize, Math.round(baseWidth * scale)),
    drawHeight: Math.min(maximumPhantomDrawSize, Math.round(baseHeight * scale)),
    canvasSize: Math.min(
      maximumPhantomCanvasSize,
      Math.round(Math.max(baseCanvasSize, Math.max(baseWidth, baseHeight) + 18) * scale),
    ),
  };
};

const loadPhantomSprite = (type: PhantomVehicle["type"]) => {
  const cachedPromise = phantomSpriteImageCache.get(type);
  if (cachedPromise) {
    return cachedPromise;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      phantomSpriteElementCache.set(type, image);
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Could not load ${type} sprite.`));
    image.src = phantomVehicleSpriteConfig[type].imageUrl;
  });

  phantomSpriteImageCache.set(type, promise);
  return promise;
};

const getPhantomVehicleIcon = (
  type: PhantomVehicle["type"],
  headingDegrees: number,
  zoomLevel = baseMapZoom,
): { iconKey: string; icon: google.maps.Icon } => {
  const config = phantomVehicleSpriteConfig[type];
  const sizing = getPhantomVehicleSizing(type, zoomLevel);
  const spriteRotationDegrees = normalizeDegrees(90 - headingDegrees + config.rotationOffsetDegrees);
  const quantizedHeading = normalizeDegrees(quantizeDegrees(spriteRotationDegrees));
  const iconKey = `${type}-${quantizedHeading}-${sizing.drawWidth}x${sizing.drawHeight}-${sizing.canvasSize}`;
  const cachedDataUrl = phantomSpriteIconCache.get(iconKey);

  if (cachedDataUrl) {
    return {
      iconKey,
      icon: {
        url: cachedDataUrl,
        scaledSize: new google.maps.Size(sizing.canvasSize, sizing.canvasSize),
        anchor: new google.maps.Point(sizing.canvasSize / 2, sizing.canvasSize / 2),
      },
    };
  }

  const spriteImage = phantomSpriteElementCache.get(type);
  if (!spriteImage) {
    return {
      iconKey,
      icon: {
        url: config.imageUrl,
        scaledSize: new google.maps.Size(sizing.drawWidth, sizing.drawHeight),
        anchor: new google.maps.Point(sizing.drawWidth / 2, sizing.drawHeight / 2),
      },
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = sizing.canvasSize;
  canvas.height = sizing.canvasSize;

  const context = canvas.getContext("2d");
  if (!context) {
    return {
      iconKey,
      icon: {
        url: config.imageUrl,
        scaledSize: new google.maps.Size(sizing.drawWidth, sizing.drawHeight),
        anchor: new google.maps.Point(sizing.drawWidth / 2, sizing.drawHeight / 2),
      },
    };
  }

  context.translate(sizing.canvasSize / 2, sizing.canvasSize / 2);
  context.rotate((quantizedHeading * Math.PI) / 180);
  context.shadowColor = "rgba(15, 23, 42, 0.28)";
  context.shadowBlur = 8;
  context.shadowOffsetY = 4;
  context.drawImage(
    spriteImage,
    -sizing.drawWidth / 2,
    -sizing.drawHeight / 2,
    sizing.drawWidth,
    sizing.drawHeight,
  );

  const dataUrl = canvas.toDataURL("image/png");
  phantomSpriteIconCache.set(iconKey, dataUrl);

  return {
    iconKey,
    icon: {
      url: dataUrl,
      scaledSize: new google.maps.Size(sizing.canvasSize, sizing.canvasSize),
      anchor: new google.maps.Point(sizing.canvasSize / 2, sizing.canvasSize / 2),
    },
  };
};

const applyPhantomVehicleIcon = (
  runtime: PhantomVehicleRuntime,
  headingDegrees: number,
  zoomLevel: number,
) => {
  const { iconKey, icon } = getPhantomVehicleIcon(runtime.type, headingDegrees, zoomLevel);
  if (iconKey === runtime.lastIconKey) {
    return;
  }

  runtime.lastIconKey = iconKey;
  runtime.marker.setIcon(icon);
};

const assignPhantomRoute = (
  runtime: PhantomVehicleRuntime,
  routePath: LatLng[],
  zoomLevel: number,
) => {
  const { segmentLengths, totalLength } = getPathMetrics(routePath);
  const startProgress = runtime.travelDirection === 1 ? 0 : totalLength;
  const initialPosition = runtime.travelDirection === 1 ? routePath[0] : routePath[routePath.length - 1];

  runtime.routePath = routePath;
  runtime.routeSegmentLengths = segmentLengths;
  runtime.routeLengthMeters = totalLength;
  runtime.progressMeters = startProgress;
  runtime.parked = false;
  runtime.opacity = 0.92;
  runtime.fadeDirection = 0;
  runtime.hiddenUntilSeconds = null;
  runtime.lastPosition = initialPosition;
  runtime.lastHeadingDegrees = getPathTangentHeading(routePath, segmentLengths, startProgress, runtime.travelDirection);
  runtime.displayHeadingDegrees = runtime.lastHeadingDegrees;
  runtime.marker.setPosition(initialPosition);
  runtime.marker.setOpacity(runtime.opacity);
  applyPhantomVehicleIcon(runtime, runtime.displayHeadingDegrees, zoomLevel);
};

const parkPhantomVehicle = (
  runtime: PhantomVehicleRuntime,
  position: LatLng,
  zoomLevel: number,
) => {
  runtime.routePath = null;
  runtime.routeSegmentLengths = [];
  runtime.routeLengthMeters = 0;
  runtime.progressMeters = 0;
  runtime.parked = true;
  runtime.fadeDirection = 0;
  runtime.hiddenUntilSeconds = null;
  runtime.opacity = 0.92;
  runtime.lastPosition = position;
  runtime.lastHeadingDegrees = runtime.travelDirection === 1 ? 0 : 180;
  runtime.displayHeadingDegrees = runtime.lastHeadingDegrees;
  runtime.marker.setPosition(position);
  runtime.marker.setOpacity(runtime.opacity);
  applyPhantomVehicleIcon(runtime, runtime.displayHeadingDegrees, zoomLevel);
};

const resolvePhantomRoadPath = async (vehicle: PhantomVehicle) => {
  const candidates = getPhantomRouteCandidates(vehicle);

  for (const candidate of candidates) {
    const routePath = await getDrivingRoutePath(candidate.origin, candidate.destination);
    if (!routePath || routePath.length < 2) {
      continue;
    }

    const { totalLength } = getPathMetrics(routePath);
    const nearestDistance = getNearestDistanceToPath(vehicle.position, routePath);

    if (totalLength < 35 || nearestDistance > 90) {
      continue;
    }

    return routePath;
  }

  return buildFallbackPhantomRoute(vehicle);
};

const buildUserLocationIcon = () => ({
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="10" fill="#3b82f6" fill-opacity="0.18" />
      <circle cx="14" cy="14" r="6.5" fill="#2563eb" stroke="#ffffff" stroke-width="3" />
    </svg>
  `)}`,
  scaledSize: new google.maps.Size(28, 28),
  anchor: new google.maps.Point(14, 14),
});

const RideMap = ({
  pickup,
  dropoff,
  driverLocation,
  onMapClick,
  selectingFor,
  userLocation,
  userLocationRadiusMeters,
  phantomVehicles = [],
}: RideMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const zoomListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const markerRefs = useRef<{
    pickup: google.maps.Marker | null;
    dropoff: google.maps.Marker | null;
    driver: google.maps.Marker | null;
  }>({
    pickup: null,
    dropoff: null,
    driver: null,
  });
  const phantomVehicleRuntimeRefs = useRef<Map<string, PhantomVehicleRuntime>>(new Map());
  const phantomAnimationFrameRef = useRef<number | null>(null);
  const userLocationCircleRef = useRef<google.maps.Circle | null>(null);
  const userLocationMarkerRef = useRef<google.maps.Marker | null>(null);
  const lastViewportSignatureRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapPainted, setMapPainted] = useState(false);
  const [mapZoom, setMapZoom] = useState(baseMapZoom);

  const defaultCenter = useMemo(
    () => userLocation || pickup || dropoff || driverLocation || kathmanduCenter,
    [driverLocation, dropoff, pickup, userLocation],
  );
  const viewportSignature = useMemo(
    () => [
      getViewportPointKey(pickup),
      getViewportPointKey(dropoff),
      getViewportPointKey(driverLocation),
      getViewportPointKey(userLocation),
    ].join("|"),
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
          zoom: baseMapZoom,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });

        setMapPainted(false);
        setMapZoom(mapRef.current.getZoom() || baseMapZoom);
        setMapReady(true);
        googleMaps.maps.event.addListenerOnce(mapRef.current, "idle", () => {
          if (!cancelled) {
            setMapPainted(true);
          }
        });
        zoomListenerRef.current = mapRef.current.addListener("zoom_changed", () => {
          setMapZoom(mapRef.current?.getZoom() || baseMapZoom);
        });
      } catch (error) {
        setLoadError((error as Error).message || "Could not load Google Maps.");
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
      clickListenerRef.current?.remove();
      zoomListenerRef.current?.remove();
      routePolylineRef.current?.setMap(null);
      Object.values(markerRefs.current).forEach((marker) => marker?.setMap(null));
      if (phantomAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(phantomAnimationFrameRef.current);
        phantomAnimationFrameRef.current = null;
      }
      phantomVehicleRuntimeRefs.current.forEach((runtime) => runtime.marker.setMap(null));
      phantomVehicleRuntimeRefs.current.clear();
      userLocationCircleRef.current?.setMap(null);
      userLocationMarkerRef.current?.setMap(null);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !window.google?.maps) {
      return;
    }

    const refreshMapLayout = () => {
      if (!container.offsetWidth || !container.offsetHeight) {
        return;
      }

      const center = map.getCenter();
      window.google.maps.event.trigger(map, "resize");
      if (center) {
        map.setCenter(center);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(refreshMapLayout);
    });
    resizeObserver.observe(container);

    const handleWindowResize = () => {
      window.requestAnimationFrame(refreshMapLayout);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        window.requestAnimationFrame(refreshMapLayout);
      }
    };

    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("orientationchange", handleWindowResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.requestAnimationFrame(refreshMapLayout);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      window.removeEventListener("orientationchange", handleWindowResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mapReady]);

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
  }, [mapReady, onMapClick, selectingFor]);

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

    const showPickupMarker = !arePointsNearby(pickup, userLocation);

    syncMarker("pickup", showPickupMarker ? pickup : null, pickupIconUrl, "Pickup");
    syncMarker("dropoff", dropoff, dropoffIconUrl, "Destination");
    syncMarker("driver", driverLocation, driverIconUrl, "Driver");
  }, [driverLocation, dropoff, mapReady, pickup, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) {
      return;
    }

    if (!userLocation) {
      userLocationCircleRef.current?.setMap(null);
      userLocationCircleRef.current = null;
      userLocationMarkerRef.current?.setMap(null);
      userLocationMarkerRef.current = null;
      return;
    }

    const radius = clampUserLocationRadius(userLocationRadiusMeters);

    if (!userLocationCircleRef.current) {
      userLocationCircleRef.current = new google.maps.Circle({
        map,
        center: userLocation,
        radius,
        clickable: false,
        fillColor: "#60a5fa",
        fillOpacity: 0.16,
        strokeColor: "#60a5fa",
        strokeOpacity: 0.28,
        strokeWeight: 1,
        zIndex: 1,
      });
    } else {
      userLocationCircleRef.current.setMap(map);
      userLocationCircleRef.current.setCenter(userLocation);
      userLocationCircleRef.current.setRadius(radius);
    }

    if (!userLocationMarkerRef.current) {
      userLocationMarkerRef.current = new google.maps.Marker({
        map,
        position: userLocation,
        title: "Your location",
        icon: buildUserLocationIcon(),
        zIndex: 7,
      });
      return;
    }

    userLocationMarkerRef.current.setMap(map);
    userLocationMarkerRef.current.setPosition(userLocation);
    userLocationMarkerRef.current.setIcon(buildUserLocationIcon());
  }, [mapReady, userLocation, userLocationRadiusMeters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) {
      return;
    }

    const activeIds = new Set(phantomVehicles.map((vehicle) => vehicle.id));
    let cancelled = false;

    phantomVehicleRuntimeRefs.current.forEach((runtime, markerId) => {
      if (activeIds.has(markerId)) {
        return;
      }

      runtime.marker.setMap(null);
      phantomVehicleRuntimeRefs.current.delete(markerId);
    });

    const syncPhantomTraffic = async () => {
      await Promise.all([loadPhantomSprite("car"), loadPhantomSprite("bike")]).catch(() => {});
      if (cancelled) {
        return;
      }

      await Promise.all(phantomVehicles.map(async (vehicle) => {
        const existingRuntime = phantomVehicleRuntimeRefs.current.get(vehicle.id);
        const runtime = existingRuntime || createParkedRuntime(vehicle, map, mapZoom);

        if (!existingRuntime) {
          phantomVehicleRuntimeRefs.current.set(vehicle.id, runtime);
        }

        runtime.marker.setMap(map);
        runtime.marker.setTitle(vehicle.type === "car" ? "Nearby car" : "Nearby bike");
        const basePositionShifted = getDistanceMeters(runtime.requestedBasePosition, vehicle.position) > 18;
        runtime.requestedBasePosition = vehicle.position;

        if (!existingRuntime || basePositionShifted) {
          parkPhantomVehicle(runtime, vehicle.position, mapZoom);
          const requestId = runtime.routeRequestId + 1;
          runtime.routeRequestId = requestId;

          const roadPath = await resolvePhantomRoadPath(vehicle);
          if (cancelled || runtime.routeRequestId !== requestId) {
            return;
          }

          if (!roadPath) {
            parkPhantomVehicle(runtime, vehicle.position, mapZoom);
            return;
          }

          assignPhantomRoute(runtime, roadPath, mapZoom);
          return;
        }

        applyPhantomVehicleIcon(runtime, runtime.displayHeadingDegrees, mapZoom);
      }));
    };

    void syncPhantomTraffic();

    return () => {
      cancelled = true;
    };
  }, [mapReady, mapZoom, phantomVehicles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps || phantomVehicles.length === 0) {
      if (phantomAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(phantomAnimationFrameRef.current);
        phantomAnimationFrameRef.current = null;
      }
      return;
    }

    let lastTimestamp = 0;

    const animatePhantomVehicles = (timestamp: number) => {
      const elapsedSeconds = timestamp / 1000;
      const deltaSeconds = lastTimestamp === 0 ? 0 : Math.min((timestamp - lastTimestamp) / 1000, 0.12);
      lastTimestamp = timestamp;

      phantomVehicleRuntimeRefs.current.forEach((runtime) => {
        if (runtime.hiddenUntilSeconds && elapsedSeconds >= runtime.hiddenUntilSeconds) {
          runtime.hiddenUntilSeconds = null;
          runtime.fadeDirection = 1;
          runtime.opacity = 0;
          runtime.marker.setOpacity(runtime.opacity);
        }

        if (runtime.fadeDirection !== 0) {
          runtime.opacity = Math.min(Math.max(runtime.opacity + runtime.fadeDirection * deltaSeconds * 1.8, 0), 0.92);
          runtime.marker.setOpacity(runtime.opacity);

          if (runtime.opacity <= 0 && runtime.fadeDirection === -1) {
            runtime.fadeDirection = 0;
            runtime.hiddenUntilSeconds = elapsedSeconds + 1.2 + (hashVehicleId(runtime.id) % 3) * 0.45;
            return;
          }

          if (runtime.opacity >= 0.92 && runtime.fadeDirection === 1) {
            runtime.fadeDirection = 0;
          }
        }

        if (runtime.hiddenUntilSeconds || runtime.parked || !runtime.routePath || runtime.routeLengthMeters <= 0) {
          if (runtime.parked) {
            runtime.marker.setOpacity(0.92);
          }
          return;
        }

        runtime.progressMeters += runtime.travelDirection * runtime.speedMetersPerSecond * deltaSeconds;

        if (runtime.progressMeters >= runtime.routeLengthMeters) {
          const overflowMeters = runtime.progressMeters - runtime.routeLengthMeters;
          runtime.travelDirection = -1;
          runtime.progressMeters = Math.max(runtime.routeLengthMeters - overflowMeters, 0);
        } else if (runtime.progressMeters <= 0) {
          const overflowMeters = Math.abs(runtime.progressMeters);
          runtime.travelDirection = 1;
          runtime.progressMeters = Math.min(overflowMeters, runtime.routeLengthMeters);
        }

        const nextPosition = getInterpolatedPathPoint(
          runtime.routePath,
          runtime.routeSegmentLengths,
          runtime.progressMeters,
        );

        if (!nextPosition) {
          parkPhantomVehicle(runtime, runtime.requestedBasePosition, mapZoom);
          return;
        }

        const targetHeadingDegrees = getPathTangentHeading(
          runtime.routePath,
          runtime.routeSegmentLengths,
          runtime.progressMeters,
          runtime.travelDirection,
        );
        runtime.lastHeadingDegrees = targetHeadingDegrees;
        runtime.displayHeadingDegrees = interpolateDegrees(
          runtime.displayHeadingDegrees,
          targetHeadingDegrees,
          Math.min(1, deltaSeconds * 6.5),
        );
        runtime.lastPosition = nextPosition;
        runtime.marker.setPosition(nextPosition);
        runtime.marker.setOpacity(runtime.opacity);
        applyPhantomVehicleIcon(runtime, runtime.displayHeadingDegrees, mapZoom);
      });

      phantomAnimationFrameRef.current = window.requestAnimationFrame(animatePhantomVehicles);
    };

    phantomAnimationFrameRef.current = window.requestAnimationFrame(animatePhantomVehicles);

    return () => {
      if (phantomAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(phantomAnimationFrameRef.current);
        phantomAnimationFrameRef.current = null;
      }
    };
  }, [mapReady, mapZoom, phantomVehicles]);

  useEffect(() => {
    let cancelled = false;

    const updateViewportAndRoute = async () => {
      const map = mapRef.current;
      if (!map || !window.google?.maps) {
        return;
      }

      if (lastViewportSignatureRef.current === viewportSignature) {
        return;
      }

      routePolylineRef.current?.setMap(null);
      routePolylineRef.current = null;

      const bounds = new google.maps.LatLngBounds();
      const viewportPoints: LatLng[] = [];

      if (pickup) viewportPoints.push(pickup);
      if (dropoff) viewportPoints.push(dropoff);
      if (driverLocation) viewportPoints.push(driverLocation);
      if (userLocation && !dropoff && !arePointsNearby(userLocation, pickup)) {
        viewportPoints.push(userLocation);
      }

      if (pickup && dropoff) {
        const routePath = await getPreviewRoutePath(pickup, dropoff);

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
        lastViewportSignatureRef.current = viewportSignature;
        return;
      }

      if (viewportPoints.length === 1) {
        map.setCenter(viewportPoints[0]);
        map.setZoom(singlePointViewportZoom);
        lastViewportSignatureRef.current = viewportSignature;
        return;
      }

      if (userLocation) {
        map.setCenter(userLocation);
        map.setZoom(userLocationViewportZoom);
        lastViewportSignatureRef.current = viewportSignature;
        return;
      }

      map.setCenter(defaultCenter);
      map.setZoom(13);
      lastViewportSignatureRef.current = viewportSignature;
    };

    updateViewportAndRoute();

    return () => {
      cancelled = true;
    };
  }, [defaultCenter, driverLocation, dropoff, mapReady, pickup, userLocation, viewportSignature]);

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
        <>
          <div ref={containerRef} className="h-full min-h-[300px] w-full rounded-xl bg-muted/20" />
          {!mapPainted && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/78 text-sm text-muted-foreground backdrop-blur-sm">
              Loading map...
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RideMap;
