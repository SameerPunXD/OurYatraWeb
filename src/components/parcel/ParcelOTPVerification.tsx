import DeliveryVerificationDialog from "@/components/delivery/DeliveryVerificationDialog";

interface ParcelOTPVerificationProps {
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  open: boolean;
  parcelId: string;
}

const ParcelOTPVerification = ({
  onOpenChange,
  onVerified,
  open,
  parcelId,
}: ParcelOTPVerificationProps) => (
  <DeliveryVerificationDialog
    description="Enter the 6-digit delivery code provided by the sender to complete this parcel delivery."
    onOpenChange={onOpenChange}
    onVerified={onVerified}
    open={open}
    orderId={parcelId}
    target="parcel_order"
    title="Parcel Verification"
  />
);

export default ParcelOTPVerification;
