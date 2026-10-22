"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ExportPanel } from "@/components/export/export-dialog";
import { getBrowserTimeZone } from "@/lib/date-utils";
import { fromInputs, toTimeInput } from "@/lib/format";
import { refreshMe } from "@/hooks/use-me";

const DAYS = [
  { n: 1, short: "Mon" },
  { n: 2, short: "Tue" },
  { n: 3, short: "Wed" },
  { n: 4, short: "Thu" },
  { n: 5, short: "Fri" },
  { n: 6, short: "Sat" },
  { n: 7, short: "Sun" },
];

const toTime = (min: number) => toTimeInput(new Date(2000, 0, 1, Math.floor(min / 60), min % 60));
const toMin = (t: string) => {
  const d = fromInputs("2000-01-01", t);
  return d ? d.getHours() * 60 + d.getMinutes() : null;
};

/** Founder: company name, working days and hours, and data export */
export function CompanySettingsPanel() {
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/company")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setName(d.org.name);
        setDays(d.org.work_days);
        setStart(toTime(d.org.work_start));
        setEnd(toTime(d.org.work_end));
        setEmailConfigured(d.email_configured);
        setLoaded(true);
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ws = toMin(start);
    const we = toMin(end);
    if (ws === null || we === null || we <= ws)
      return toast.error("Working hours must end after they start");
    if (days.length === 0) return toast.error("Pick at least one working day");
    setSaving(true);
    const res = await fetch("/api/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, work_days: days, work_start: ws, work_end: we }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return toast.error(d.error || "Couldn’t save");
    }
    refreshMe();
    toast.success("Company settings saved");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Company</h2>
        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <label className="block max-w-md space-y-1.5">
              <span className="text-[13px] font-medium">Company name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="h-10"
              />
            </label>
            <div className="space-y-2">
              <span className="text-[13px] font-medium">Working days &amp; hours</span>
              <p className="text-xs text-muted-foreground">
                Used to suggest meeting times when everyone is free.
              </p>
              <div role="group" aria-label="Working days" className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => {
                  const on = days.includes(d.n);
                  return (
                    <button
                      key={d.n}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setDays((ds) => (on ? ds.filter((x) => x !== d.n) : [...ds, d.n].sort()))
                      }
                      className={cn(
                        "h-8 rounded-full px-3 text-[13px] font-medium",
                        on
                          ? "bg-foreground text-background"
                          : "border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label="Day starts"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="h-9 w-auto"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="time"
                  aria-label="Day ends"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="h-9 w-auto"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
              <Link href="/team/settings" className="text-[13px] text-[#1967d2] hover:underline">
                Planner visibility &amp; goal templates
              </Link>
            </div>
          </>
        )}
      </form>

      <section className="space-y-2 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Email</h2>
        <p className="text-sm text-muted-foreground">
          {emailConfigured === null
            ? "Checking…"
            : emailConfigured
              ? "Invites and meeting emails are being sent."
              : "Not set up — invites still work by copying links. To send emails, add an email account (a normal Gmail with an app password works) as SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in your hosting settings."}
        </p>
      </section>

      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Data export</h2>
        <p className="text-[13px] text-muted-foreground">
          Copy out everything your company has planned and done: every member’s tasks (time blocks
          with hours and what was worked on) as a spreadsheet, or all company data as JSON. Planner
          PDFs for any member — or everyone — are below.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              window.open(
                `/api/admin/export?format=csv&tz=${encodeURIComponent(getBrowserTimeZone())}`,
                "_blank",
              )
            }
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> All tasks (CSV)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open("/api/admin/export", "_blank")}
          >
            <Download className="h-3.5 w-3.5" /> Export all data
          </Button>
        </div>
      </section>

      <ExportPanel defaultWhose="all" />
    </div>
  );
}
