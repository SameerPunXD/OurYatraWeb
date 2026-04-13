import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed, Search, Star, Clock, MapPin } from "lucide-react";

const FoodOrder = () => {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState("all");
  const [minRating, setMinRating] = useState(0);

  useEffect(() => {
    supabase.from("restaurants").select("*").eq("is_open", true)
      .then(({ data }) => { setRestaurants(data || []); setLoading(false); });
  }, []);

  const cuisines = useMemo(() => {
    const set = new Set(restaurants.map((r) => r.cuisine_type).filter(Boolean));
    return Array.from(set).sort();
  }, [restaurants]);

  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !(r.cuisine_type || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (cuisineFilter !== "all" && r.cuisine_type !== cuisineFilter) return false;
      if (minRating > 0 && (r.rating || 0) < minRating) return false;
      return true;
    });
  }, [restaurants, search, cuisineFilter, minRating]);

  if (loading) return <p className="text-muted-foreground">Loading restaurants...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-foreground">Order Food</h2>
        <Button variant="outline" size="sm" onClick={() => navigate("/rider/food/history")}>Order History</Button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search restaurants or cuisines..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={cuisineFilter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setCuisineFilter("all")}>All</Badge>
          {cuisines.map((c) => (
            <Badge key={c} variant={cuisineFilter === c ? "default" : "outline"} className="cursor-pointer" onClick={() => setCuisineFilter(c)}>{c}</Badge>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Min rating:</span>
          {[0, 3, 3.5, 4, 4.5].map((r) => (
            <Badge key={r} variant={minRating === r ? "default" : "outline"} className="cursor-pointer" onClick={() => setMinRating(r)}>
              {r === 0 ? "Any" : `${r}★`}
            </Badge>
          ))}
        </div>
      </div>

      {/* Restaurant Grid */}
      {filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No restaurants found</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Card key={r.id} className="cursor-pointer hover:border-primary/40 transition-colors overflow-hidden" onClick={() => navigate(`/rider/food/restaurant/${r.id}`)}>
              {r.image_url && (
                <div className="h-36 bg-muted overflow-hidden">
                  <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
                </div>
              )}
              {!r.image_url && (
                <div className="h-36 bg-muted flex items-center justify-center">
                  <UtensilsCrossed className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <CardContent className="p-4 space-y-1">
                <h3 className="font-semibold text-foreground text-lg">{r.name}</h3>
                {r.cuisine_type && <p className="text-sm text-muted-foreground">{r.cuisine_type}</p>}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {(r.rating || 0) > 0 && (
                    <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />{Number(r.rating).toFixed(1)}</span>
                  )}
                  {r.estimated_delivery_time && (
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{r.estimated_delivery_time}</span>
                  )}
                </div>
                {r.address && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{r.address}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FoodOrder;
