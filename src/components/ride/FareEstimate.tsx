import { useState } from "react";
import { Car, Bike, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LatLng { lat: number; lng: number; }

interface FareEstimateProps {
  pickup: LatLng;
  dropoff: LatLng;
  onBook: (vehicleType: string, fare: number, scheduledAt: string | null, notes: string) => void;
  booking: boolean;
}

const vehicleTypes = [
  { value: "bike", label: "Bike", icon: Bike, perKm: 30, minFare: 30 },
  { value: "auto", label: "Auto", icon: Car, perKm: 40, minFare: 40 },
  { value: "taxi", label: "Taxi Cab", icon: Car, perKm: 60, minFare: 60 },
];

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const FareEstimate = ({ pickup, dropoff, onBook, booking }: FareEstimateProps) => {
  const [vehicleType, setVehicleType] = useState("bike");
  const [scheduled, setScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [notes, setNotes] = useState("");

  const distance = haversine(pickup, dropoff);
  const selected = vehicleTypes.find(v => v.value === vehicleType)!;
  const fare = Math.max(selected.minFare, Math.round(distance * selected.perKm));

  const handleBook = () => {
    let scheduledAt: string | null = null;
    if (scheduled && scheduleDate && scheduleTime) {
      scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    }
    onBook(vehicleType, fare, scheduledAt, notes);
  };

  const canBook = !scheduled || (scheduleDate && scheduleTime);

  return (
    <div className="space-y-4">
      {/* Vehicle selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {vehicleTypes.map(v => {
          const Icon = v.icon;
          const vFare = Math.max(v.minFare, Math.round(distance * v.perKm));
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => setVehicleType(v.value)}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                vehicleType === v.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40"
              )}
            >
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", vehicleType === v.value ? "bg-primary/10" : "bg-muted")}>
                <Icon className={cn("h-5 w-5", vehicleType === v.value ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-foreground">{v.label}</p>
                <p className="text-xs text-muted-foreground">Rs {vFare}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Fare breakdown */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Distance</span>
            <span className="font-medium text-foreground">{distance.toFixed(1)} km</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Rate</span>
            <span className="text-foreground">Rs {selected.perKm}/km</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Distance charge</span>
            <span className="text-foreground">Rs {Math.round(distance * selected.perKm)}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-lg text-primary">Rs {fare}</span>
          </div>
        </CardContent>
      </Card>

      {/* Schedule toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Schedule for later</Label>
          </div>
          <Switch checked={scheduled} onCheckedChange={setScheduled} />
        </div>
        {scheduled && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Time</Label>
              <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <Input placeholder="Notes for driver (optional)" value={notes} onChange={e => setNotes(e.target.value)} />

      {/* Book button */}
      <Button className="w-full h-12 text-base font-semibold" disabled={booking || !canBook} onClick={handleBook}>
        {booking ? "Booking..." : scheduled ? (
          <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Schedule Ride — Rs {fare}</span>
        ) : (
          `Book Now — Rs ${fare}`
        )}
      </Button>
    </div>
  );
};

export default FareEstimate;
