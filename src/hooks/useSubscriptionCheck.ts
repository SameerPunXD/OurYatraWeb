import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useSubscriptionCheck = () => {
  const { user } = useAuth();
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHasActiveSubscription(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte("ends_at", new Date().toISOString())
        .limit(1);
      setHasActiveSubscription((data?.length || 0) > 0);
      setLoading(false);
    };
    check();
  }, [user]);

  return { hasActiveSubscription, loading };
};
