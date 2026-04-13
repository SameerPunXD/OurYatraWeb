import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderType: "ride" | "parcel" | "food_order";
  toUserId?: string;
  restaurantId?: string;
  title?: string;
}

const RatingDialog = ({ open, onOpenChange, orderId, orderType, toUserId, restaurantId, title = "Rate your experience" }: RatingDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSubmitting(true);
    const { error } = await supabase.from("ratings").insert({
      from_user_id: user.id,
      to_user_id: toUserId || null,
      restaurant_id: restaurantId || null,
      order_id: orderId,
      order_type: orderType,
      rating,
      comment: comment || null,
    } as any);
    if (error) toast({ title: "Failed to submit rating", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Rating submitted!", description: "Thank you for your feedback." });
      onOpenChange(false);
      setRating(0);
      setComment("");
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center gap-1 py-4">
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} type="button" onClick={() => setRating(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}>
              <Star className={cn("h-8 w-8 transition-colors", (hover || rating) >= s ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
            </button>
          ))}
        </div>
        <Textarea placeholder="Leave a comment (optional)" value={comment} onChange={e => setComment(e.target.value)} rows={3} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={rating === 0 || submitting}>
            {submitting ? "Submitting..." : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RatingDialog;
