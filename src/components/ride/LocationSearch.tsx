import { useState, useEffect, useRef } from "react";
import { MapPin, Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface LatLng {
  lat: number;
  lng: number;
}

interface SearchResult {
  place_name: string;
  center: [number, number];
}

interface LocationIqResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationSearchProps {
  label: string;
  placeholder: string;
  value: string;
  onSelect: (name: string, latlng: LatLng) => void;
  onClear: () => void;
  onFocusSelect?: () => void;
  iconColor?: string;
  proximity?: LatLng | null;
}

const LocationSearch = ({ label, placeholder, value, onSelect, onClear, onFocusSelect, iconColor = "text-primary", proximity = null }: LocationSearchProps) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) { setResults([]); setOpen(false); return; }

    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    const locationIqKey = import.meta.env.VITE_LOCATIONIQ_API_KEY;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // 1) Try LocationIQ autocomplete first
        if (locationIqKey) {
          const viewbox = proximity
            ? `&viewbox=${proximity.lng - 0.2},${proximity.lat + 0.2},${proximity.lng + 0.2},${proximity.lat - 0.2}&bounded=0`
            : "";
          const liqRes = await fetch(
            `https://us1.locationiq.com/v1/autocomplete?key=${locationIqKey}&q=${encodeURIComponent(q)}&limit=8&dedupe=1&countrycodes=np${viewbox}&format=json`
          );

          if (liqRes.ok) {
            const liqData: LocationIqResult[] = await liqRes.json();
            const mapped: SearchResult[] = (liqData || []).map((r) => ({
              place_name: r.display_name,
              center: [Number(r.lon), Number(r.lat)],
            }));
            if (mapped.length > 0) {
              setResults(mapped);
              setOpen(true);
              setLoading(false);
              return;
            }
          }
        }

        // 2) Fallback to Mapbox if LocationIQ has no results
        if (token) {
          const proximityParam = proximity ? `&proximity=${proximity.lng},${proximity.lat}` : "";
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&autocomplete=true&limit=8&country=np${proximityParam}`
          );
          const data = await res.json();
          const features: SearchResult[] = data?.features || [];
          setResults(features);
          setOpen(features.length > 0);
        } else {
          setResults([]);
          setOpen(false);
        }
      } catch {
        setResults([]);
        setOpen(false);
      }
      setLoading(false);
    }, 400);
  };

  const handleSelect = (r: SearchResult) => {
    const fullName = r.place_name;
    setQuery(fullName);
    setOpen(false);
    onSelect(fullName, { lat: r.center[1], lng: r.center[0] });
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <div className="relative">
        <MapPin className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4", iconColor)} />
        <Input
          className="pl-9 pr-9"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => { onFocusSelect?.(); if (results.length > 0) setOpen(true); }}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
        {!loading && query && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => { setQuery(""); setResults([]); onClear(); }}>
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2.5 hover:bg-accent text-sm flex items-start gap-2 border-b border-border last:border-0 transition-colors"
              onClick={() => handleSelect(r)}
            >
              <Search className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span className="text-foreground line-clamp-2">{r.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
