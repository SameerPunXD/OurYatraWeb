import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

const reasons = [
  "Changed my plans",
  "Driver is too far",
  "Found other transport",
  "Booked by mistake",
];

type RideStatus = Database["public"]["Enums"]["ride_status"];

const CANCELLABLE_RIDE_STATUSES: RideStatus[] = ["pending", "accepted"];

interface CancelRideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  rideStatus: RideStatus;
  onCancelled: () => void;
}

const CancelRideDialog = ({ open, onOpenChange, rideId, rideStatus, onCancelled }: CancelRideDialogProps) => {
  const { toast } = useToast();
  const [selected, setSelected] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected("");
      setOtherReason("");
      setCancelling(false);
    }
  }, [open]);

  const handleCancel = async () => {
    const reason = selected === "Other" ? otherReason : selected;
    if (!reason) return;

    if (!CANCELLABLE_RIDE_STATUSES.includes(rideStatus)) {
      toast({
        title: "Ride can no longer be cancelled",
        description: "Only rides that have not started yet can be cancelled.",
        variant: "destructive",
      });
      return;
    }

    setCancelling(true);

    const { data, error } = await supabase
      .from("rides")
      .update({
        status: "cancelled" as any,
        cancellation_reason: reason,
      })
      .eq("id", rideId)
      .in("status", CANCELLABLE_RIDE_STATUSES)
      .select("id, status")
      .maybeSingle();

    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else if (!data) {
      toast({
        title: "Ride can no longer be cancelled",
        description: "This ride was already updated, so the cancellation did not go through.",
        variant: "destructive",
      });
    } else {
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
