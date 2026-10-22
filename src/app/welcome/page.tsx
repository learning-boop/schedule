"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompanySetup } from "@/components/onboarding/company-setup";
import { InvitePeopleForm, type InviteTeam } from "@/components/invites/invite-people-form";
import { refreshMe, type Me } from "@/hooks/use-me";

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  );
}

function Steps({ step }: { step: 2 | 3 }) {
  const items = ["Account", "Your company", "Invite your team"];
  return (
    <ol aria-label="Setup steps" className="flex flex-wrap items-center gap-3 text-[13px]">
      {items.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-3">
            {i > 0 && <span aria-hidden className="h-px w-8 bg-border" />}
            <span
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-2",
                done && "text-[#137333]",
                current && "font-semibold",
                !done && !current && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  done && "bg-[#e6f4ea]",
                  current && "bg-foreground text-background",
                  !done && !current && "border",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Welcome() {
  const router = useRouter();
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [teams, setTeams] = useState<InviteTeam[] | null>(null);
  const [sent, setSent] = useState(false);
  const step: 2 | 3 = params.get("step") === "invite" && me?.org ? 3 : 2;

  useEffect(() => {
    refreshMe();
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((m: Me | null) => {
        setMe(m);
        // Already in a company and not here to invite people: go to the app
        if (m?.org && params.get("step") !== "invite") router.replace("/");
      });
  }, [params, router]);

  useEffect(() => {
    if (step !== 3) return;
    fetch("/api/teams")
      .then((r) => (r.ok ? r.json() : { teams: [] }))
      .then((d) => setTeams((d.teams ?? []).map((t: InviteTeam) => ({ id: t.id, name: t.name }))))
      .catch(() => setTeams([]));
  }, [step]);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-svh bg-muted/40">
      <header className="flex h-14 items-center gap-3 border-b bg-background px-4 sm:px-6">
        <span className="text-lg font-semibold">Schedule Planner</span>
        <span className="ml-auto hidden text-[13px] text-muted-foreground sm:inline">
          {me?.email}
        </span>
        <button
          type="button"
          onClick={signOut}
          className="text-[13px] font-medium text-[#1967d2] hover:underline"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
        {me === undefined ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : step === 2 ? (
          <>
            <Steps step={2} />
            <div className="space-y-1.5">
              <h1 className="text-3xl font-semibold tracking-tight">
                Welcome{me?.name ? `, ${me.name.split(" ")[0]}` : ""}
              </h1>
              <p className="text-[15px] text-muted-foreground">
                Join the company that invited you, or start your own. An account belongs to one
                company at a time.
              </p>
            </div>
            <CompanySetup email={me?.email} />
          </>
        ) : (
          <>
            <Steps step={3} />
            <div className="space-y-1.5">
              <h1 className="text-3xl font-semibold tracking-tight">
                Invite your team to {me?.org?.name}
              </h1>
              <p className="text-[15px] text-muted-foreground">
                Add their work emails. Everyone you invite can see the team calendar and book time
                with each other.
              </p>
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <section className="rounded-2xl border bg-background p-5 sm:p-6">
                {teams === null ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <InvitePeopleForm
                    teams={teams}
                    canInviteManagers
                    defaultTeamId={teams[0]?.id ?? ""}
                    onSent={() => setSent(true)}
                  />
                )}
              </section>
              <aside className="space-y-3 rounded-2xl bg-muted p-5 text-[13px] leading-relaxed">
                <h2 className="text-[15px] font-semibold">How invites work</h2>
                <p>
                  Each person gets an email with their own private link — or copy the link and share
                  it on WhatsApp or Slack.
                </p>
                <p>Links work for 7 days, once, and only for the email they were sent to.</p>
                <p>
                  A manager you add to a team becomes its lead. Employees report to their team lead
                  — change it any time in Team → Admin.
                </p>
                <p>There’s no limit on how many people you invite.</p>
              </aside>
            </div>
            <div className="flex gap-2">
              <Button className="h-10 px-5" onClick={() => router.push("/team/week")}>
                {sent ? "Go to the team calendar" : "Skip for now"}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
