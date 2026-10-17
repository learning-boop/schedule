"use client";

import { useEffect, useState } from "react";
import { FileDown, Link2, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { formatDate, getWeekStart, getMonthStart } from "@/lib/date-utils";

type ExportResult = {
  token: string;
  filename: string;
  expiresAt: string;
  downloadUrl: string;
};

export function ExportPanel() {
  const [type, setType] = useState("day");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const now = new Date();
    setSelectedDate(now);
    setRangeStart(getMonthStart(now));
    setRangeEnd(now);
  }, []);

  async function handleExport() {
    setLoading(true);
    setError(null);
    setResult(null);

    const body: Record<string, string> = { type };

    if (type === "day" && selectedDate) {
      body.date = formatDate(selectedDate);
    } else if (type === "week" && selectedDate) {
      body.weekStart = formatDate(getWeekStart(selectedDate));
    } else if (type === "month" && selectedDate) {
      body.month = formatDate(getMonthStart(selectedDate));
    } else if (type === "full" && rangeStart && rangeEnd) {
      body.startDate = formatDate(rangeStart);
      body.endDate = formatDate(rangeEnd);
    } else if (type === "goals") {
      // No date needed
    }

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Export failed");
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyShareLink() {
    if (!result) return;
    const url = `${window.location.origin}${result.downloadUrl}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!selectedDate) return null;

  const needsDate = type === "day" || type === "week" || type === "month";
  const needsRange = type === "full";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Export PDF</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium">Export type</p>
          <Select
            value={type}
            onValueChange={(v) => {
              if (v) setType(v);
              setResult(null);
            }}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Single Day</SelectItem>
              <SelectItem value="week">One Week</SelectItem>
              <SelectItem value="month">One Month</SelectItem>
              <SelectItem value="goals">Goals Page</SelectItem>
              <SelectItem value="full">Full Planner (Date Range)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {needsDate && (
          <div className="space-y-2">
            <p className="text-xs font-medium">
              {type === "day" ? "Date" : type === "week" ? "Week containing" : "Month"}
            </p>
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full justify-start gap-1.5 text-xs"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {selectedDate.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {needsRange && rangeStart && rangeEnd && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5 text-xs">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {rangeStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={rangeStart}
                  onSelect={(d) => d && setRangeStart(d)}
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5 text-xs">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {rangeEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar mode="single" selected={rangeEnd} onSelect={(d) => d && setRangeEnd(d)} />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <Button onClick={handleExport} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <FileDown className="mr-1.5 h-3.5 w-3.5" /> Generate PDF
            </>
          )}
        </Button>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {result && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium text-green-600">PDF ready!</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => window.open(result.downloadUrl, "_blank")}
              >
                <FileDown className="mr-1 h-3.5 w-3.5" /> Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={copyShareLink}
              >
                {copied ? (
                  <>
                    <Check className="mr-1 h-3.5 w-3.5" /> Copied!
                  </>
                ) : (
                  <>
                    <Link2 className="mr-1 h-3.5 w-3.5" /> Share Link
                  </>
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Link expires {new Date(result.expiresAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
