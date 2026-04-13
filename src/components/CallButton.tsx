import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CallButtonProps {
  phone: string | null | undefined;
}

const CallButton = ({ phone }: CallButtonProps) => {
  if (!phone) return null;
  return (
    <Button variant="outline" size="sm" className="gap-1.5" asChild>
      <a href={`tel:${phone}`}>
        <Phone className="h-4 w-4" /> Call
      </a>
    </Button>
  );
};

export default CallButton;
