import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star } from "lucide-react";

const AdminRatings = () => {
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("ratings").select("*").order("created_at", { ascending: false }).limit(200);
      if (!data) { setLoading(false); return; }
      const userIds = [...new Set([...data.map(r => r.from_user_id), ...data.filter(r => r.to_user_id).map(r => r.to_user_id!)])];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || "Unknown"]));
      setRatings(data.map(r => ({ ...r, fromName: nameMap[r.from_user_id] || "Unknown", toName: r.to_user_id ? nameMap[r.to_user_id] || "Unknown" : "N/A" })));
      setLoading(false);
    };
    load();
  }, []);

  const filtered = ratings.filter(r => tab === "all" || r.order_type === tab);
  const typeColors: Record<string, string> = { ride: "bg-blue-100 text-blue-800", food: "bg-orange-100 text-orange-800", parcel: "bg-purple-100 text-purple-800" };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Ratings ({ratings.length})</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="ride">Rides</TabsTrigger>
          <TabsTrigger value="food">Food</TabsTrigger>
          <TabsTrigger value="parcel">Parcels</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No ratings found</CardContent></Card>
          ) : filtered.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                    <Badge className={typeColors[r.order_type] || ""}>{r.order_type}</Badge>
                  </div>
                  <p className="text-sm text-foreground">From: {r.fromName} → To: {r.toName}</p>
                  {r.comment && <p className="text-sm text-muted-foreground italic">"{r.comment}"</p>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminRatings;
