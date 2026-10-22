"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { refreshMe } from "@/hooks/use-me";
import { fromInputs, toTimeInput } from "@/lib/format";

type MyInvite = {
  id: string;
  token: string;
  role: "employee" | "manager";
  team: string | null;
  inviter: string | null;
  expires_at: string;
  org: { id: string; name: string; members: number };
};

const DAYS = [
  { n: 1, short: "M", label: "Monday" },
  { n: 2, short: "T", label: "Tuesday" },
  { n: 3, short: "W", label: "Wednesday" },
  { n: 4, short: "T", label: "Thursday" },
  { n: 5, short: "F", label: "Friday" },
  { n: 6, short: "S", label: "Saturday" },
  { n: 7, short: "S", label: "Sunday" },
];

function minutesFromTime(t: string) {
  const d = fromInputs("2000-01-01", t);
  return d ? d.getHours() * 60 + d.getMinutes() : null;
}

/**
 * Join the company that invited you, or start a new one (you become its
 * founder). Shown after sign-up, and on team pages for anyone without a company.
 */
export function CompanySetup({
  email,
  onCreated,
  onJoined,
}: {
  email?: string;
  onCreated?: () => void;
  onJoined?: () => void;
}) {
  const router = useRouter();
  const [invites, setInvites] = useState<MyInvite[] | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [startTime, setStartTime] = useState(toTimeInput(new Date(2000, 0, 1, 9)));
  const [endTime, setEndTime] = useState(toTimeInput(new Date(2000, 0, 1, 18)));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/invites/mine")
      .then((r) => (r.ok ? r.json() : []))
      .then(setInvites)
      .catch(() => setInvites([]));
  }, []);

  async function join(invite: MyInvite) {
    setJoining(invite.id);
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: invite.token }),
    });
    const data = await res.json().catch(() => ({}));
    setJoining(null);
    if (!res.ok) {
      toast.error(data.error || "Couldn’t join");
      return;
    }
    refreshMe();
    toast.success(`Welcome to ${invite.org.name}!`);
    if (onJoined) onJoined();
    else {
      router.push("/team/week");
      router.refresh();
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ws = minutesFromTime(startTime);
    const we = minutesFromTime(endTime);
    if (!name.trim()) return setError("Enter your company’s name");
    if (days.length === 0) return setError("Pick at least one working day");
    if (ws === null || we === null || we <= ws)
      return setError("Working hours must end after they start");
    setCreating(true);
    const res = await fetch("/api/company/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        team_name: teamName.trim() || undefined,
        work_days: days,
        work_start: ws,
        work_end: we,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) {
      setError(data.error || "Couldn’t create the company");
      return;
    }
    refreshMe();
    if (onCreated) onCreated();
    else router.push("/welcome?step=invite");
  }

  return (
    <div className="grid items-start gap-5 md:grid-cols-2">
      {/* Invitations for this email */}
      <section
        aria-label="Your invitations"
        className={cn(
          "space-y-4 rounded-2xl border bg-background p-5 sm:p-6",
          invites && invites.length > 0 && "border-2 border-[#1967d2]",
        )}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ea] px-2.5 py-1 text-xs font-medium text-[#0d652d]">
          <Mail className="h-3.5 w-3.5" />
          {invites === null
            ? "Checking for invitations…"
            : invites.length
              ? invites.length === 1
                ? "Invitation found for your email"
                : `${invites.length} invitations for your email`
              : "No invitations yet"}
        </span>

        {invites === null && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        {invites?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Joining a company that already uses Schedule Planner? Ask its founder or your team lead
            to invite {email ? <b className="text-foreground">{email}</b> : "your email"}, then open
            the link they send you — or come back here.
          </p>
        )}

        {invites?.map((inv) => (
          <div key={inv.id} className="space-y-4">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground text-xl font-semibold text-background">
                {inv.org.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{inv.org.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {inv.inviter ? `${inv.inviter} invited you` : "You’re invited"} ·{" "}
                  {inv.org.members} {inv.org.members === 1 ? "person" : "people"}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium capitalize">{inv.role}</dd>
              <dt className="text-muted-foreground">Team</dt>
              <dd className="font-medium">{inv.team ?? "—"}</dd>
              <dt className="text-muted-foreground">Expires</dt>
              <dd className="font-medium">
                {new Date(inv.expires_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </dl>
            <Button
              className="h-11 w-full bg-[#1967d2] text-[15px] text-white hover:bg-[#174ea6]"
              onClick={() => join(inv)}
              disabled={!!joining}
            >
              {joining === inv.id && <Loader2 className="h-4 w-4 animate-spin" />}
              Join {inv.org.name}
            </Button>
          </div>
        ))}
      </section>

      {/* Start a company */}
      <form
        onSubmit={create}
        aria-label="Start a new company"
        className="space-y-4 rounded-2xl border bg-background p-5 sm:p-6"
      >
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Start a new company</h2>
            <p className="text-sm text-muted-foreground">
              For founders setting up their team. You’ll be the Founder and can invite people next.
            </p>
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium">Company name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunrise Clinics"
            maxLength={120}
            className="h-10"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium">
            Your first team <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <Input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Operations"
            maxLength={60}
            className="h-10"
          />
        </label>
        <div className="space-y-2">
          <span className="text-[13px] font-medium">
            Working days &amp; hours{" "}
            <span className="font-normal text-muted-foreground">
              — used to suggest meeting times
            </span>
          </span>
          <div role="group" aria-label="Working days" className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => {
              const on = days.includes(d.n);
              return (
                <button
                  key={d.n}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.label}
                  onClick={() =>
                    setDays((ds) => (on ? ds.filter((x) => x !== d.n) : [...ds, d.n].sort()))
                  }
                  className={cn(
                    "h-9 w-9 rounded-full text-[13px] font-medium transition-colors",
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
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-9 w-auto"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="time"
              aria-label="Day ends"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="h-9 w-auto"
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          variant="outline"
          className="h-11 w-full border-foreground text-[15px]"
          disabled={creating}
        >
          {creating && <Loader2 className="h-4 w-4 animate-spin" />}
          Create company
        </Button>
      </form>
    </div>
  );
}
