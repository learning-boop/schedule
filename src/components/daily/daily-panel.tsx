"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDailyPage } from "@/hooks/use-daily-page";
import { useGoals } from "@/hooks/use-goals";
import { Top3 } from "./top3";
import { MatrixView } from "./matrix";
import { Trackers } from "./trackers";
import { Notes } from "./notes";
import { DoneToday } from "./done-today";
import { formatDate, parseLocalDate } from "@/lib/date-utils";

function formatDisplay(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function DailyPanel() {
  const [date, setDate] = useState("");
  const { page, loading, save } = useDailyPage(date);
  const { goals } = useGoals();

  useEffect(() => {
    setDate(formatDate(new Date()));
  }, []);

  function goDay(offset: number) {
    const d = parseLocalDate(date);
    d.setDate(d.getDate() + offset);
    setDate(formatDate(d));
  }

  function goToday() {
    setDate(formatDate(new Date()));
  }

  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(formatDate(new Date()));
  }, []);
  const isToday = date === today;

  if (!date || loading || !page) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Date navigation */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goDay(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium flex-1 text-center">
          {formatDisplay(new Date(date + "T00:00:00"))}
        </span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goDay(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isToday && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goToday}>
            Today
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="top3" className="flex-1 overflow-auto">
        <TabsList className="w-full justify-start rounded-none border-b px-4">
          <TabsTrigger value="top3" className="text-xs">
            Top 3
          </TabsTrigger>
          <TabsTrigger value="matrix" className="text-xs">
            Matrix
          </TabsTrigger>
          <TabsTrigger value="trackers" className="text-xs">
            Trackers
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">
            Notes
          </TabsTrigger>
          <TabsTrigger value="done" className="text-xs">
            Done
          </TabsTrigger>
        </TabsList>

        <div className="p-4">
          <TabsContent value="top3" className="mt-0">
            <Top3 items={page.top3} goals={goals} onChange={(top3) => save({ top3 })} />
          </TabsContent>

          <TabsContent value="matrix" className="mt-0">
            <MatrixView matrix={page.matrix} onChange={(matrix) => save({ matrix })} />
          </TabsContent>

          <TabsContent value="trackers" className="mt-0">
            <Trackers
              water={page.water}
              fitness={page.fitness}
              onWaterChange={(water) => save({ water })}
              onFitnessChange={(fitness) => save({ fitness })}
            />
          </TabsContent>

          <TabsContent value="notes" className="mt-0">
            <Notes value={page.notes} onChange={(notes) => save({ notes })} />
          </TabsContent>

          <TabsContent value="done" className="mt-0">
            <DoneToday date={date} top3={page.top3} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
