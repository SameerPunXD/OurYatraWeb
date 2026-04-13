import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, AlertCircle } from "lucide-react";

interface ParcelOTPVerificationProps {
  parcelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}

const ParcelOTPVerification = ({ parcelId, open, onOpenChange, onVerified }: ParcelOTPVerificationProps) => {
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 4) { setError("Enter 4-digit OTP"); return; }
    setLoading(true);
    setError("");

    // Fetch the parcel's stored OTP
    const { data: parcel } = await supabase.from("parcels").select("delivery_otp").eq("id", parcelId).single();
    
    if (!parcel || (parcel as any).delivery_otp !== otp) {
      setError("Incorrect OTP. Please try again.");
      setLoading(false);
      return;
    }

    // OTP matches — mark as verified then delivered
    const { error: updateError } = await supabase.from("parcels").update({
      status: "otp_verified" as any,
      otp_verified_at: new Date().toISOString(),
    } as any).eq("id", parcelId);

    if (updateError) {
      toast({ title: "Failed", description: updateError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Brief delay then mark as delivered
    setTimeout(async () => {
      await supabase.from("parcels").update({
        status: "delivered" as any,
        delivered_at: new Date().toISOString(),
      } as any).eq("id", parcelId);
      toast({ title: "Delivery confirmed!", description: "Parcel marked as delivered." });
      onVerified();
      onOpenChange(false);
      setOtp("");
    }, 1000);

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> OTP Verification
          </DialogTitle>
          <DialogDescription>
            Enter the 4-digit OTP provided by the recipient to confirm delivery.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <InputOTP maxLength={4} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
            </InputOTPGroup>
          </InputOTP>
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}
          <Button className="w-full" onClick={handleVerify} disabled={loading || otp.length !== 4}>
            {loading ? "Verifying..." : "Verify & Complete Delivery"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ParcelOTPVerification;
