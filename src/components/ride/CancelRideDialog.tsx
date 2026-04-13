import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const reasons = [
  "Changed my plans",
  "Driver is too far",
  "Found other transport",
  "Booked by mistake",
];

interface CancelRideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  onCancelled: () => void;
}

const CancelRideDialog = ({ open, onOpenChange, rideId, onCancelled }: CancelRideDialogProps) => {
  const { toast } = useToast();
  const [selected, setSelected] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    const reason = selected === "Other" ? otherReason : selected;
    if (!reason) return;
    setCancelling(true);
    const { error } = await supabase.from("rides").update({
      status: "cancelled" as any,
      cancellation_reason: reason,
    }).eq("id", rideId).eq("status", "pending");
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Ride cancelled" });
      onOpenChange(false);
      onCancelled();
    }
    setCancelling(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why are you cancelling?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {[...reasons, "Other"].map(r => (
            <button
              key={r}
              onClick={() => setSelected(r)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-lg border transition-colors text-sm",
                selected === r ? "border-primary bg-primary/5 text-foreground" : "border-border hover:border-primary/40 text-foreground"
              )}
            >
              {r}
            </button>
          ))}
          {selected === "Other" && (
            <Textarea
              placeholder="Tell us why..."
              value={otherReason}
              onChange={e => setOtherReason(e.target.value)}
              rows={2}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go Back</Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={!selected || (selected === "Other" && !otherReason) || cancelling}
          >
            {cancelling ? "Cancelling..." : "Cancel Ride"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelRideDialog;
