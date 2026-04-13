import { useEffect, useMemo, useState } from "react";
import { Bus, CalendarDays, Clock3, MapPin, Ticket, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import SubscriptionGate from "@/components/SubscriptionGate";
import BusSeatPicker from "@/components/buses/BusSeatPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sortBusSeatLabels } from "@/lib/busSeats";
import { NEPAL_DISTRICTS } from "@/lib/nepalDistricts";
import type { Database } from "@/integrations/supabase/types";

type BusRow = Database["public"]["Tables"]["buses"]["Row"];

const formatTime = (value: string | null) => (value ? value.slice(0, 5) : "N/A");
const todayValue = () => new Date().toISOString().split("T")[0];

const RiderBuses = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [fromDistrict, setFromDistrict] = useState("");
  const [toDistrict, setToDistrict] = useState("");
  const [travelDate, setTravelDate] = useState(todayValue());
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTouched, setSearchTouched] = useState(false);
  const [bookingBusId, setBookingBusId] = useState<string | null>(null);
  const [bookingDialogBusId, setBookingDialogBusId] = useState<string | null>(null);
  const [selectedSeatNumbers, setSelectedSeatNumbers] = useState<Record<string, string[]>>({});
  const [reservedSeatNumbers, setReservedSeatNumbers] = useState<Record<string, string[]>>({});
  const [reservedSeatsLoadingBusId, setReservedSeatsLoadingBusId] = useState<string | null>(null);
  const [passengerForms, setPassengerForms] = useState<Record<string, { name: string; phone: string }>>({});

  const canSearch = Boolean(fromDistrict && toDistrict && travelDate && fromDistrict !== toDistrict);

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [bookings],
  );
  const activeBookingBus = useMemo(
    () => buses.find((bus) => bus.id === bookingDialogBusId) || null,
    [buses, bookingDialogBusId],
  );

  const ensurePassengerDefaults = (busId: string) => {
    setPassengerForms((current) => {
      if (current[busId]) return current;
      return {
        ...current,
        [busId]: {
          name: profile?.full_name || "",
          phone: profile?.phone || "",
        },
      };
    });
    setSelectedSeatNumbers((current) => ({ ...current, [busId]: current[busId] || [] }));
  };

  const fetchReservedSeats = async (busId: string, force = false) => {
    if (!force && reservedSeatNumbers[busId]) {
      return reservedSeatNumbers[busId];
    }

    setReservedSeatsLoadingBusId(busId);
    const { data, error } = await supabase.rpc("get_bus_reserved_seats", { _bus_id: busId });
    setReservedSeatsLoadingBusId((current) => (current === busId ? null : current));

    if (error) {
      toast({
        title: "Could not load seat map",
        description: error.message,
        variant: "destructive",
      });
      return [];
    }

    const normalizedSeats = sortBusSeatLabels(data || []);
    setReservedSeatNumbers((current) => ({ ...current, [busId]: normalizedSeats }));
    setSelectedSeatNumbers((current) => ({
      ...current,
      [busId]: (current[busId] || []).filter((seatNumber) => !normalizedSeats.includes(seatNumber)),
    }));

    return normalizedSeats;
  };

  const fetchBookings = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("bus_bookings")
      .select(
        "id, bus_id, seat_numbers, seats_booked, total_amount, passenger_name, passenger_phone, status, created_at, buses(id, bus_name, bus_number, from_district, to_district, departure_date, departure_time, status, notes)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Could not load bus bookings",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setBookings(data || []);
  };

  useEffect(() => {
    fetchBookings();
  }, [user]);

  const searchBuses = async () => {
    if (!canSearch) return;
    setLoading(true);
    setSearchTouched(true);

    const { data, error } = await supabase
      .from("buses")
      .select("*")
      .eq("status", "active")
      .eq("from_district", fromDistrict)
      .eq("to_district", toDistrict)
      .eq("departure_date", travelDate)
      .gt("available_seats", 0)
      .order("departure_time", { ascending: true });

    if (error) {
      toast({
        title: "Could not search buses",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setBuses(data || []);
    (data || []).forEach((bus) => ensurePassengerDefaults(bus.id));
    setLoading(false);
  };

  const openBookingDialog = (bus: BusRow) => {
    ensurePassengerDefaults(bus.id);
    setBookingDialogBusId(bus.id);
    void fetchReservedSeats(bus.id, true);
  };

  const toggleSeatSelection = (bus: BusRow, seatNumber: string) => {
    const reservedSeats = reservedSeatNumbers[bus.id] || [];
    if (reservedSeats.includes(seatNumber)) {
      return;
    }

    setSelectedSeatNumbers((current) => {
      const currentSeats = current[bus.id] || [];
      if (currentSeats.includes(seatNumber)) {
        return {
          ...current,
          [bus.id]: currentSeats.filter((existingSeat) => existingSeat !== seatNumber),
        };
      }

      if (currentSeats.length >= bus.available_seats) {
        toast({
          title: "Seat limit reached",
          description: `Only ${bus.available_seats} seats are available on this bus.`,
          variant: "destructive",
        });
        return current;
      }

      return {
        ...current,
        [bus.id]: sortBusSeatLabels([...currentSeats, seatNumber]),
      };
    });
  };

  const handleBook = async (bus: BusRow) => {
    if (!user) return;

    const seatNumbers = sortBusSeatLabels(selectedSeatNumbers[bus.id] || []);
    const seats = seatNumbers.length;
    const passengerForm = passengerForms[bus.id] || {
      name: profile?.full_name || "",
      phone: profile?.phone || "",
    };

    if (!passengerForm.name.trim() || !passengerForm.phone.trim()) {
      toast({
        title: "Passenger details required",
        description: "Enter passenger name and phone before booking.",
        variant: "destructive",
      });
      return;
    }

    if (seats < 1 || seats > bus.available_seats) {
      toast({
        title: "Select seats",
        description: `Choose between 1 and ${bus.available_seats} seats from the bus diagram.`,
        variant: "destructive",
      });
      return;
    }

    const latestReservedSeats = await fetchReservedSeats(bus.id, true);
    const conflictingSeat = seatNumbers.find((seatNumber) => latestReservedSeats.includes(seatNumber));

    if (conflictingSeat) {
      toast({
        title: "Seat no longer available",
        description: `Seat ${conflictingSeat} was just booked by someone else. Please choose another seat.`,
        variant: "destructive",
      });
      return;
    }

    setBookingBusId(bus.id);

    const { error } = await supabase.from("bus_bookings").insert({
      bus_id: bus.id,
      user_id: user.id,
      seat_numbers: seatNumbers,
      seats_booked: seats,
      total_amount: Number(bus.price) * seats,
      passenger_name: passengerForm.name.trim(),
      passenger_phone: passengerForm.phone.trim(),
      status: "confirmed",
    });

    if (error) {
      toast({
        title: "Booking failed",
        description: error.message,
        variant: "destructive",
      });
      setBookingBusId(null);
      return;
    }

    toast({
      title: "Bus booked",
      description: `Seats ${seatNumbers.join(", ")} on ${bus.bus_name} are confirmed.`,
    });

    setSelectedSeatNumbers((current) => ({ ...current, [bus.id]: [] }));
    setBookingDialogBusId(null);
    await Promise.all([searchBuses(), fetchBookings()]);
    setBookingBusId(null);
  };

  const handleCancelBooking = async (bookingId: string) => {
    const booking = bookings.find((item) => item.id === bookingId);
    const { error } = await supabase
      .from("bus_bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (error) {
      toast({
        title: "Could not cancel booking",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Booking cancelled",
      description: "Your bus booking has been cancelled.",
    });

    await Promise.all([
      fetchBookings(),
      canSearch ? searchBuses() : Promise.resolve(),
      booking?.bus_id ? fetchReservedSeats(booking.bus_id, true) : Promise.resolve([]),
    ]);
  };

  return (
    <SubscriptionGate fallbackMessage="Subscribe to book buses on OurYatra.">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Buses</h2>
          <p className="text-sm text-muted-foreground">
            Search scheduled buses across Nepal&apos;s 77 districts and reserve your seats.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search Buses</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Select value={fromDistrict} onValueChange={setFromDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {NEPAL_DISTRICTS.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>To</Label>
              <Select value={toDistrict} onValueChange={setToDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {NEPAL_DISTRICTS.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" min={todayValue()} value={travelDate} onChange={(event) => setTravelDate(event.target.value)} />
            </div>

            <div className="flex items-end">
              <Button className="w-full" disabled={!canSearch || loading} onClick={searchBuses}>
                {loading ? "Searching..." : "Search buses"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Buses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!searchTouched ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground" />
            ) : buses.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No active buses found for this route and date.
              </div>
            ) : (
              buses.map((bus) => {
                const amenities = bus.amenities || [];
                const form = passengerForms[bus.id] || { name: profile?.full_name || "", phone: profile?.phone || "" };
                const selectedSeats = sortBusSeatLabels(selectedSeatNumbers[bus.id] || []);
                const seats = selectedSeats.length;

                return (
                  <Card key={bus.id} className="border-primary/10">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{bus.bus_number}</Badge>
                            <span className="font-semibold text-foreground">{bus.bus_name}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {bus.from_district} to {bus.to_district}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-4 w-4" />
                              {new Date(bus.departure_date).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock3 className="h-4 w-4" />
                              {formatTime(bus.departure_time)} to {formatTime(bus.arrival_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {bus.available_seats}/{bus.total_seats} seats left
                            </span>
                          </div>
                          {amenities.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Amenities: {amenities.join(", ")}
                            </p>
                          )}
                          {bus.notes && (
                            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                              <span className="font-medium">Boarding / arrival notes:</span> {bus.notes}
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg bg-primary/5 px-4 py-3 text-right">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Fare</p>
                          <p className="text-2xl font-bold text-primary">Rs {Number(bus.price)}</p>
                          <p className="text-xs text-muted-foreground">per seat</p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Passenger Name</Label>
                          <Input
                            value={form.name}
                            onChange={(event) =>
                              setPassengerForms((current) => ({
                                ...current,
                                [bus.id]: {
                                  ...(current[bus.id] || form),
                                  name: event.target.value,
                                },
                              }))
                            }
                            placeholder="Passenger full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Passenger Phone</Label>
                          <Input
                            value={form.phone}
                            onChange={(event) =>
                              setPassengerForms((current) => ({
                                ...current,
                                [bus.id]: {
                                  ...(current[bus.id] || form),
                                  phone: event.target.value,
                                },
                              }))
                            }
                            placeholder="98XXXXXXXX"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Selected Seats</Label>
                          <div className="flex min-h-10 items-center rounded-md border border-input bg-muted/20 px-3 text-sm text-foreground">
                            {selectedSeats.length > 0 ? selectedSeats.join(", ") : "No seats selected yet"}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          {selectedSeats.length > 0 ? (
                            <>
                              Total: <span className="font-semibold text-foreground">Rs {Number(bus.price) * seats}</span>
                            </>
                          ) : (
                            "Choose seats to see the total fare."
                          )}
                        </p>
                        <Button onClick={() => openBookingDialog(bus)} disabled={bookingBusId === bus.id}>
                          {bookingBusId === bus.id ? "Booking..." : "Book this bus"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Bus Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedBookings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                You have not booked any buses yet.
              </div>
            ) : (
              sortedBookings.map((booking: any) => (
                <div key={booking.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-primary" />
                        <p className="font-medium text-foreground">
                          {booking.buses?.bus_name || "Bus"} ({booking.buses?.bus_number || "N/A"})
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {booking.buses?.from_district} to {booking.buses?.to_district}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.buses?.departure_date
                          ? new Date(booking.buses.departure_date).toLocaleDateString()
                          : "Date not available"}
                        {" • "}
                        {formatTime(booking.buses?.departure_time || null)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Seats: {booking.seats_booked} • Total: Rs {Number(booking.total_amount)}
                      </p>
                      {Array.isArray(booking.seat_numbers) && booking.seat_numbers.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Seat numbers: {sortBusSeatLabels(booking.seat_numbers).join(", ")}
                        </p>
                      )}
                      {booking.buses?.notes && (
                        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                          <span className="font-medium">Boarding / arrival notes:</span> {booking.buses.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={booking.status === "cancelled" ? "outline" : "secondary"}>{booking.status}</Badge>
                      {booking.status !== "cancelled" && (
                        <Button variant="outline" size="sm" onClick={() => handleCancelBooking(booking.id)}>
                          Cancel booking
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(activeBookingBus)} onOpenChange={(open) => !open && setBookingDialogBusId(null)}>
          {activeBookingBus && (
            <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto p-5 sm:p-6">
              <DialogHeader>
                <DialogTitle>
                  Choose seats for {activeBookingBus.bus_name} ({activeBookingBus.bus_number})
                </DialogTitle>
                <DialogDescription>
                  {activeBookingBus.from_district} to {activeBookingBus.to_district} on{" "}
                  {new Date(activeBookingBus.departure_date).toLocaleDateString()} at {formatTime(activeBookingBus.departure_time)}.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-5">
                <BusSeatPicker
                  totalSeats={activeBookingBus.total_seats}
                  reservedSeats={reservedSeatNumbers[activeBookingBus.id] || []}
                  selectedSeats={selectedSeatNumbers[activeBookingBus.id] || []}
                  onToggleSeat={(seatNumber) => toggleSeatSelection(activeBookingBus, seatNumber)}
                  disabled={reservedSeatsLoadingBusId === activeBookingBus.id || bookingBusId === activeBookingBus.id}
                />

                <div className="space-y-4">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Seat Summary</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Available seats: {activeBookingBus.available_seats} of {activeBookingBus.total_seats}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Selected seats:
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {(selectedSeatNumbers[activeBookingBus.id] || []).length > 0
                        ? sortBusSeatLabels(selectedSeatNumbers[activeBookingBus.id] || []).join(", ")
                        : "No seats selected"}
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Total fare:
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      Rs {Number(activeBookingBus.price) * (selectedSeatNumbers[activeBookingBus.id] || []).length}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Passenger Name</Label>
                      <Input
                        value={passengerForms[activeBookingBus.id]?.name || ""}
                        onChange={(event) =>
                          setPassengerForms((current) => ({
                            ...current,
                            [activeBookingBus.id]: {
                              name: event.target.value,
                              phone: current[activeBookingBus.id]?.phone || profile?.phone || "",
                            },
                          }))
                        }
                        placeholder="Passenger full name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Passenger Phone</Label>
                      <Input
                        value={passengerForms[activeBookingBus.id]?.phone || ""}
                        onChange={(event) =>
                          setPassengerForms((current) => ({
                            ...current,
                            [activeBookingBus.id]: {
                              name: current[activeBookingBus.id]?.name || profile?.full_name || "",
                              phone: event.target.value,
                            },
                          }))
                        }
                        placeholder="98XXXXXXXX"
                      />
                    </div>

                    {activeBookingBus.notes && (
                      <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                        <span className="font-medium">Boarding / arrival notes:</span> {activeBookingBus.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={() => setBookingDialogBusId(null)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleBook(activeBookingBus)}
                      disabled={bookingBusId === activeBookingBus.id || reservedSeatsLoadingBusId === activeBookingBus.id}
                    >
                      {bookingBusId === activeBookingBus.id
                        ? "Booking..."
                        : reservedSeatsLoadingBusId === activeBookingBus.id
                          ? "Loading seats..."
                          : "Confirm booking"}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </SubscriptionGate>
  );
};

export default RiderBuses;
