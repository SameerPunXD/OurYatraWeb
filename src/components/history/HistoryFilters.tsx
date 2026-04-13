import { ReactNode } from "react";
import { format } from "date-fns";
import { CalendarIcon, Filter, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HistoryFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  statusOptions: { value: string; label: string }[];
  dateFrom?: Date;
  dateTo?: Date;
  onDateFromChange: (d: Date | undefined) => void;
  onDateToChange: (d: Date | undefined) => void;
  onClear: () => void;
  extraFilters?: ReactNode;
}

const HistoryFilters = ({
  search, onSearchChange,
  statusFilter, onStatusChange, statusOptions,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  onClear, extraFilters,
}: HistoryFiltersProps) => {
  const hasFilters = search || statusFilter !== "all" || dateFrom || dateTo;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filters</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={onClear}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statusOptions.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {extraFilters}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4 mr-1" />
                {dateFrom ? format(dateFrom, "MMM d") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={onDateFromChange} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4 mr-1" />
                {dateTo ? format(dateTo, "MMM d") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={onDateToChange} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
};

export default HistoryFilters;
