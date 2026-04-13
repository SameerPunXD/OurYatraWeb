import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailRow {
  label: string;
  value: string | number | null | undefined;
}

interface HistoryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  type: "ride" | "parcel" | "food";
  status?: string;
  statusColor?: string;
  rows: DetailRow[];
  items?: { name: string; quantity: number; price: number }[];
  rating?: number | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  picked_up: "bg-cyan-100 text-cyan-800",
  on_the_way: "bg-blue-100 text-blue-800",
  delivered: "bg-green-200 text-green-900",
  in_transit: "bg-blue-100 text-blue-800",
};

const HistoryDetailDialog = ({
  open, onOpenChange, title, type, status, rows, items, rating,
}: HistoryDetailDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{title}</span>
            {status && (
              <Badge className={statusColors[status] || "bg-muted text-foreground"}>
                {status.replace(/_/g, " ")}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {rows.filter(r => r.value != null && r.value !== "").map((row, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium text-foreground text-right max-w-[60%]">{row.value}</span>
            </div>
          ))}

          {items && items.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Items</p>
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span className="text-muted-foreground">{item.name} × {item.quantity}</span>
                    <span className="text-foreground">Rs {item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {rating != null && rating > 0 && (
            <>
              <Separator />
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground mr-2">Rating</span>
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className={cn("h-4 w-4", s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                ))}
                <span className="text-sm text-muted-foreground ml-1">{rating}/5</span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HistoryDetailDialog;
