import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: Date;
  read: boolean;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      const mapped = (data as any[]).map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        time: new Date(n.created_at),
        read: n.is_read,
      }));
      setNotifications(mapped);
      setUnreadCount(mapped.filter(n => !n.read).length);
    }
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notif-dropdown")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as any;
          setNotifications(prev => [{
            id: n.id, title: n.title, message: n.message, time: new Date(n.created_at), read: false,
          }, ...prev].slice(0, 20));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true } as any).eq("user_id", user.id).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [user]);

  return { notifications, unreadCount, markAllRead };
};
