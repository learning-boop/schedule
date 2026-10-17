"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReports } from "@/hooks/use-reports";
import { formatDate } from "@/lib/date-utils";
import { DateRangePicker } from "./date-range-picker";
import { HoursByGoalChart, HoursByCategoryChart } from "./hours-chart";
import { PlannedVsActualChart } from "./planned-vs-actual-chart";
import { GoalProgressChart } from "./goal-progress-chart";

export function ReportsDashboard() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(start);
    setEndDate(now);
  }, []);

  const start = startDate ? formatDate(startDate) : "";
  const end = endDate ? formatDate(endDate) : "";

  const { hours, plannedVsActual, goalProgress, groupBy, setGroupBy, loading } = useReports(
    start,
    end,
  );

  if (!startDate || !endDate) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker
          start={startDate}
          end={endDate}
          onChange={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
        />
        <Select
          value={groupBy}
          onValueChange={(val) => setGroupBy(val as "day" | "week" | "month")}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading reports...</p>
      ) : (
        <Tabs defaultValue="hours">
          <TabsList>
            <TabsTrigger value="hours">Hours</TabsTrigger>
            <TabsTrigger value="planned">Planned vs Actual</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
          </TabsList>

          <TabsContent value="hours">
            <div className="space-y-4 pt-2">
              <HoursByGoalChart data={hours} groupBy={groupBy} />
              <HoursByCategoryChart data={hours} groupBy={groupBy} />
            </div>
          </TabsContent>

          <TabsContent value="planned">
            <div className="pt-2">
              <PlannedVsActualChart data={plannedVsActual} />
            </div>
          </TabsContent>

          <TabsContent value="goals">
            <div className="pt-2">{goalProgress && <GoalProgressChart data={goalProgress} />}</div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
