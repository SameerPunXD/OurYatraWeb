import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Star, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import RatingDisplay from "@/components/RatingDisplay";

const DriverRatings = () => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("ratings")
      .select("*")
      .eq("to_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRatings(data || []);
        setLoading(false);
      });
  }, [user]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Ratings & Feedback</h2>

      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">Your Overall Rating</p>
          <div className="flex justify-center">
            <RatingDisplay userId={user?.id} />
          </div>
        </CardContent>
      </Card>

      {ratings.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <Star className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No ratings received yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {ratings.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`h-4 w-4 ${s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.order_type}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {r.comment && (
                  <p className="text-sm text-muted-foreground flex items-start gap-1">
                    <MessageCircle className="h-3 w-3 mt-1 shrink-0" /> {r.comment}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverRatings;
