import { useMemo } from "react";
import { Armchair, Sofa } from "lucide-react";
import { buildBusSeatLayout, sortBusSeatLabels } from "@/lib/busSeats";
import { cn } from "@/lib/utils";

interface BusSeatPickerProps {
  totalSeats: number;
  reservedSeats: string[];
  selectedSeats: string[];
  onToggleSeat: (seatNumber: string) => void;
  disabled?: boolean;
}

const BusSeatPicker = ({
  totalSeats,
  reservedSeats,
  selectedSeats,
  onToggleSeat,
  disabled = false,
}: BusSeatPickerProps) => {
  const seatLayoutRows = useMemo(() => buildBusSeatLayout(totalSeats), [totalSeats]);
  const reservedSeatSet = useMemo(() => new Set(sortBusSeatLabels(reservedSeats)), [reservedSeats]);
  const selectedSeatSet = useMemo(() => new Set(sortBusSeatLabels(selectedSeats)), [selectedSeats]);

  const renderLegendSeat = (label: string, tone: "available" | "selected" | "booked") => {
    const toneClassName =
      tone === "selected"
        ? "text-red-500"
        : tone === "booked"
          ? "text-slate-400"
          : "text-blue-600";

    return (
      <span className="inline-flex items-center gap-2">
        <Sofa className={cn("h-5 w-5", toneClassName)} strokeWidth={2.2} />
        {label}
      </span>
    );
  };

  const renderSeat = (seatNumber?: string) => {
    if (!seatNumber) {
      return <div className="h-16 sm:h-[4.25rem]" aria-hidden="true" />;
    }

    const reserved = reservedSeatSet.has(seatNumber);
    const selected = selectedSeatSet.has(seatNumber);
    const toneClassName = reserved ? "text-slate-400" : selected ? "text-red-500" : "text-blue-600";
    const labelClassName = reserved
      ? "border-slate-300 bg-slate-100 text-slate-500"
      : selected
        ? "border-red-200 bg-red-50 text-red-600"
        : "border-blue-200 bg-white text-blue-700";

    return (
      <button
        type="button"
        disabled={disabled || reserved}
        onClick={() => onToggleSeat(seatNumber)}
        aria-pressed={selected}
        className={cn(
          "group relative flex h-16 items-center justify-center rounded-xl border border-transparent transition-all sm:h-[4.25rem]",
          reserved && "cursor-not-allowed bg-slate-50/80 opacity-90",
          selected && "bg-red-50 shadow-sm",
          !reserved && !selected && "bg-blue-50/40 hover:-translate-y-0.5 hover:bg-blue-50",
        )}
      >
        <Sofa className={cn("h-11 w-11 transition-transform group-hover:scale-[1.03] sm:h-12 sm:w-12", toneClassName)} strokeWidth={2.2} />
        <span
          className={cn(
            "absolute top-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm sm:top-2",
            labelClassName,
          )}
        >
          {seatNumber}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-border/70 bg-card p-3 sm:p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="w-36 rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-700 sm:w-44 sm:px-4 sm:py-2 sm:text-xs">
            Front
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-700 shadow-sm sm:rounded-2xl sm:px-3 sm:py-2">
            <Armchair className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.1} />
            <div className="text-left leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Driver</p>
              <p className="text-xs font-medium">Seat</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {seatLayoutRows.map((row, rowIndex) => {
            if (row.type === "back") {
              return (
                <div key={`seat-row-${rowIndex}`} className="space-y-1.5 pt-1">
                  <div className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Back Row
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                    {Array.from({ length: 5 }, (_, seatIndex) => renderSeat(row.seats[seatIndex]))}
                  </div>
                </div>
              );
            }
            const leftSeats = row.leftSeats || [];
            const rightSeats = row.rightSeats || [];

            return (
              <div
                key={`seat-row-${rowIndex}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_0.8rem_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-2"
              >
                {renderSeat(leftSeats[0])}
                {renderSeat(leftSeats[1])}
                <div aria-hidden="true" className="rounded-full bg-slate-200/80" />
                {renderSeat(rightSeats[0])}
                {renderSeat(rightSeats[1])}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5 text-[11px] text-muted-foreground sm:gap-3 sm:text-xs">
        {renderLegendSeat("Available", "available")}
        {renderLegendSeat("Selected", "selected")}
        {renderLegendSeat("Booked", "booked")}
      </div>
    </div>
  );
};

export default BusSeatPicker;
