"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, Link2, Loader2, Check, Eye, CalendarIcon } from "lucide-react";
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
import { formatDate, getBrowserTimeZone, getMonthStart, getWeekStart } from "@/lib/date-utils";

type ExportResult = {
  token: string;
  filename: string;
  expiresAt: string;
  downloadUrl: string;
};

type Member = { id: string; name: string; role: string; manager_id: string | null };

const TYPE_LABELS: Record<string, string> = {
  day: "Single Day",
  week: "One Week",
  month: "One Month",
  goals: "Goals Page",
  full: "Full Planner (Date Range)",
};

const TYPE_HINTS: Record<string, string> = {
  day: "The workbook's “To Do Today” page.",
  week: "The week page followed by its 7 “To Do Today” pages.",
  month: "The month page (Top 3, Date and Day grid, Focus) and the SWOT page.",
  goals: "Page 1 — your 10 goals with deadlines and sub-goals.",
  full: "Goals, then each month (+ SWOT), week and day in the range.",
};

/** "me", "all" or a member id */
type Whose = string;

export function ExportPanel({ defaultWhose = "me" }: { defaultWhose?: "me" | "all" }) {
  const [type, setType] = useState("week");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [whose, setWhose] = useState<Whose>(defaultWhose);

  useEffect(() => {
    const now = new Date();
    setSelectedDate(now);
    setRangeStart(getMonthStart(now));
    setRangeEnd(now);

    fetch("/api/team/members")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setMe(data.me);
        setMembers(data.grouped.flatMap((g: { members: Member[] }) => g.members));
      })
      .catch(() => {});
  }, []);

  // Founders can export anyone (or everyone); managers their direct reports
  const exportable = useMemo(() => {
    if (!me) return [];
    if (me.role === "founder") return members.filter((m) => m.id !== me.id);
    if (me.role === "manager") return members.filter((m) => m.manager_id === me.id);
    return [];
  }, [me, members]);

  const whoseItems = useMemo(() => {
    const items: Record<string, string> = { me: "My planner" };
    for (const m of exportable) items[m.id] = m.name;
    if (me?.role === "founder") items.all = "Everyone in the company (one PDF)";
    return items;
  }, [exportable, me]);

  const showWhose = Object.keys(whoseItems).length > 1;

  function buildParams(): Record<string, string> | null {
    const params: Record<string, string> = { type, tz: getBrowserTimeZone() };
    if (type === "day" && selectedDate) params.date = formatDate(selectedDate);
    else if (type === "week" && selectedDate)
      params.weekStart = formatDate(getWeekStart(selectedDate));
    else if (type === "month" && selectedDate)
      params.month = formatDate(getMonthStart(selectedDate));
    else if (type === "full") {
      if (!rangeStart || !rangeEnd) return null;
      params.startDate = formatDate(rangeStart);
      params.endDate = formatDate(rangeEnd);
    }
    if (whose === "all") params.scope = "all";
    else if (whose !== "me") {
      params.scope = "member";
      params.userId = whose;
    }
    return params;
  }

  function handlePreview() {
    const params = buildParams();
    if (!params) return;
    window.open(`/api/export/preview?${new URLSearchParams(params)}`, "_blank", "noopener");
  }

  async function handleExport() {
    const params = buildParams();
    if (!params) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Export failed");
        return;
      }

      setResult(await res.json());
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
    <Card id="export">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Export PDF</CardTitle>
        <p className="text-xs text-muted-foreground">
          Exports use the exact pages of the paper workbook, filled in with the planner data.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {showWhose && (
          <div className="space-y-2">
            <p className="text-xs font-medium">Whose planner</p>
            <Select
              items={whoseItems}
              value={whose}
              onValueChange={(v) => {
                if (v) setWhose(v as string);
                setResult(null);
              }}
            >
              <SelectTrigger size="sm" className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(whoseItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium">Export type</p>
          <Select
            items={TYPE_LABELS}
            value={type}
            onValueChange={(v) => {
              if (v) setType(v as string);
              setResult(null);
            }}
          >
            <SelectTrigger size="sm" className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{TYPE_HINTS[type]}</p>
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
                    className="h-8 w-full max-w-xs justify-start gap-1.5 text-xs"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {type === "month"
                      ? selectedDate.toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })
                      : selectedDate.toLocaleDateString(undefined, {
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
          <div className="flex max-w-xs items-center gap-2">
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

        <div className="flex max-w-md flex-wrap gap-2">
          <Button variant="outline" onClick={handlePreview} className="flex-1">
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview PDF
          </Button>
          <Button onClick={handleExport} disabled={loading} className="flex-1">
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
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {result && (
          <div className="max-w-md space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium text-green-600">PDF ready — {result.filename}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1 text-xs"
                onClick={() => window.open(result.downloadUrl, "_blank")}
              >
                <FileDown className="mr-1 h-3.5 w-3.5" /> Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1 text-xs"
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
