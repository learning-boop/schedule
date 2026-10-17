"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export function DateRangePicker({
  start,
  end,
  onChange,
}: {
  start: Date;
  end: Date;
  onChange: (start: Date, end: Date) => void;
}) {
  const [picking, setPicking] = useState<"start" | "end" | null>(null);

  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex items-center gap-2">
      <Popover
        open={picking === "start"}
        onOpenChange={(open) => setPicking(open ? "start" : null)}
      >
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <CalendarIcon className="h-3.5 w-3.5" />
              {fmt(start)}
            </Button>
          }
        />
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={start}
            onSelect={(d) => {
              if (d) {
                onChange(d, end < d ? d : end);
                setPicking(null);
              }
            }}
          />
        </PopoverContent>
      </Popover>

      <span className="text-xs text-muted-foreground">to</span>

      <Popover open={picking === "end"} onOpenChange={(open) => setPicking(open ? "end" : null)}>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <CalendarIcon className="h-3.5 w-3.5" />
              {fmt(end)}
            </Button>
          }
        />
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={end}
            onSelect={(d) => {
              if (d) {
                onChange(start > d ? d : start, d);
                setPicking(null);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
