import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, User } from "lucide-react";

interface ChatPanelProps {
  orderId: string;
  orderType: "ride" | "parcel" | "food_order" | "garage_order";
  displayNames?: Record<string, string>;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

const ChatPanel = ({ orderId, orderType, displayNames = {} }: ChatPanelProps) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("order_id", orderId)
      .eq("order_type", orderType)
      .order("created_at", { ascending: true });

    const msgs = (data as any[]) || [];
    setMessages(msgs);

    const senderIds = [...new Set(msgs.map((m: any) => m.sender_id).filter(Boolean))];
    if (senderIds.length > 0) {
      const { data: p } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", senderIds);
      if (p) {
        const map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
        p.forEach((row: any) => { map[row.id] = { full_name: row.full_name, avatar_url: row.avatar_url }; });
        setProfiles(map);
      }
    }
  };

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel(`chat-${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `order_id=eq.${orderId}` },
        async (payload) => {
          const incoming = payload.new as ChatMessage;
          setMessages(prev => [...prev, incoming]);
          if (incoming.sender_id && !profiles[incoming.sender_id]) {
            const { data: p } = await supabase.from("profiles").select("id, full_name, avatar_url").eq("id", incoming.sender_id).maybeSingle();
            if (p) {
              setProfiles(prev => ({ ...prev, [p.id]: { full_name: p.full_name, avatar_url: p.avatar_url } }));
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    const messageText = text.trim();
    await supabase.from("chat_messages").insert({
      order_id: orderId,
      order_type: orderType,
      sender_id: user.id,
      message: messageText,
    } as any);

    try {
      let recipientIds: string[] = [];
      if (orderType === "food_order") {
        const { data } = await supabase.from("food_orders").select("customer_id,driver_id").eq("id", orderId).maybeSingle();
        recipientIds = [data?.customer_id, data?.driver_id].filter((id): id is string => !!id && id !== user.id);
      } else if (orderType === "garage_order") {
        const { data } = await (supabase as any)
          .from("garage_orders")
          .select("requester_id, driver_id, garages(owner_id)")
          .eq("id", orderId)
          .maybeSingle();
        const ownerId = data?.garages?.owner_id;
        const requesterId = data?.requester_id || data?.driver_id;
        recipientIds = [requesterId, ownerId].filter((id: any) => !!id && id !== user.id);
      }

      for (const rid of [...new Set(recipientIds)]) {
        await supabase.rpc("notify_user", {
          _user_id: rid,
          _title: "New message",
          _message: `${profile?.full_name || "Someone"}: ${messageText.slice(0, 80)}`,
          _type: "chat",
        });
      }
    } catch {}

    setText("");
    setSending(false);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <MessageCircle className="h-4 w-4" /> Chat
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col p-0 z-[2500]">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle>Chat</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 px-4 py-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No messages yet</p>
          )}
          <div className="space-y-3">
            {messages.map(m => {
              const isMine = m.sender_id === user?.id;
              const senderProfile = profiles[m.sender_id];
              const name = isMine
                ? (profile?.full_name || displayNames[m.sender_id] || senderProfile?.full_name || "You")
                : (displayNames[m.sender_id] || senderProfile?.full_name || "User");
              return (
                <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                    <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                      {senderProfile?.avatar_url ? (
                        <img src={senderProfile.avatar_url} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className={`text-[11px] mb-1 ${isMine ? "text-right" : "text-left"} text-muted-foreground`}>{name}</p>
                      <div className={`px-3 py-2 rounded-lg text-sm ${isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                        {m.message}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <div className="p-3 border-t border-border flex gap-2">
          <Input
            placeholder="Type a message..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          />
          <Button size="icon" onClick={sendMessage} disabled={sending || !text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatPanel;
