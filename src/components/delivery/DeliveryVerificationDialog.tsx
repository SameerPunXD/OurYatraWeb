import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ShieldCheck } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type DeliveryVerificationTarget = Database["public"]["Enums"]["delivery_verification_target"];

interface DeliveryVerificationDialogProps {
  description: string;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  open: boolean;
  orderId: string;
  target: DeliveryVerificationTarget;
  title: string;
}

const DeliveryVerificationDialog = ({
  description,
  onOpenChange,
  onVerified,
  open,
  orderId,
  target,
  title,
}: DeliveryVerificationDialogProps) => {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    const normalizedCode = code.replace(/\D/g, "");

    if (normalizedCode.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: verifyError } = await (supabase as any).rpc("verify_delivery_completion", {
      p_target: target,
      p_order_id: orderId,
      p_code: normalizedCode,
    });

    if (verifyError) {
      setError(verifyError.message || "Unable to verify this code.");
      setLoading(false);
      return;
    }

    toast({ title: "Delivery verified", description: "The delivery has been completed successfully." });
    setLoading(false);
    setCode("");
    onVerified();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) {
          if (!nextOpen) {
            setCode("");
            setError("");
          }
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          {error ? (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          ) : null}
          <Button className="w-full" disabled={loading || code.replace(/\D/g, "").length !== 6} onClick={handleVerify}>
            {loading ? "Verifying..." : "Verify & Complete Delivery"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryVerificationDialog;
