import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface RatingDisplayProps {
  userId?: string;
  restaurantId?: string;
  compact?: boolean;
}

const RatingDisplay = ({ userId, restaurantId, compact = false }: RatingDisplayProps) => {
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      let query = supabase.from("ratings").select("rating");
      if (userId) query = query.eq("to_user_id", userId);
      if (restaurantId) query = query.eq("restaurant_id", restaurantId);
      const { data } = await query;
      if (data && data.length > 0) {
        setCount(data.length);
        setAvg(data.reduce((s, r) => s + r.rating, 0) / data.length);
      }
    };
    if (userId || restaurantId) fetch();
  }, [userId, restaurantId]);

  if (count === 0) return compact ? null : <span className="text-sm text-muted-foreground">No ratings yet</span>;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={cn("h-4 w-4", s <= Math.round(avg) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
      ))}
      <span className="text-sm text-muted-foreground ml-1">
        {avg.toFixed(1)} ({count})
      </span>
    </div>
  );
};

export default RatingDisplay;
