import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const RestaurantReviews = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: rest } = await supabase.from("restaurants").select("id").eq("owner_id", user.id).maybeSingle();
      if (!rest) { setLoading(false); return; }
      const { data } = await supabase.from("ratings").select("*").eq("restaurant_id", rest.id).order("created_at", { ascending: false });
      const list = data || [];
      setReviews(list);

      const uids = [...new Set(list.map((r) => r.from_user_id))];
      if (uids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", uids);
        const map: Record<string, any> = {};
        (profs || []).forEach((p) => { map[p.id] = p; });
        setProfiles(map);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: reviews.length > 0 ? (reviews.filter((r) => r.rating === star).length / reviews.length) * 100 : 0,
  }));

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Reviews & Ratings</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-4xl font-bold text-foreground">{Math.round(avgRating * 10) / 10}</p>
            <div className="flex justify-center my-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`h-5 w-5 ${s <= Math.round(avgRating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{reviews.length} reviews</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {distribution.map((d) => (
              <div key={d.star} className="flex items-center gap-3">
                <span className="text-sm text-foreground w-8">{d.star} ★</span>
                <Progress value={d.pct} className="flex-1 h-2" />
                <span className="text-sm text-muted-foreground w-8">{d.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {reviews.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">No reviews yet</CardContent></Card>
        ) : (
          reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{profiles[r.from_user_id]?.full_name || "Customer"}</p>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`h-3.5 w-3.5 ${s <= r.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default RestaurantReviews;
