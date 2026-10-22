"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Lock } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";
import { MembersPanel } from "@/components/admin/members-panel";
import { TeamsPanel } from "@/components/admin/teams-panel";
import { InvitesPanel } from "@/components/admin/invites-panel";
import { CompanySettingsPanel } from "@/components/admin/company-settings-panel";

const TABS = [
  { id: "members", label: "Members" },
  { id: "teams", label: "Teams" },
  { id: "invites", label: "Invites" },
  { id: "settings", label: "Settings & export" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AdminPage() {
  return (
    <>
      <TopBar title="Admin" />
      <Suspense fallback={null}>
        <Admin />
      </Suspense>
    </>
  );
}

function Admin() {
  const me = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : "members";

  if (me === undefined) return <p className="p-6 text-sm text-muted-foreground">Loading...</p>;
  if (me?.role !== "founder") {
    return (
      <div className="mx-auto w-full max-w-lg p-4 sm:p-6">
        <section className="space-y-3 rounded-2xl border bg-background p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </span>
          <h2 className="text-lg font-semibold">Only the founder can manage the company</h2>
          <p className="text-sm text-muted-foreground">
            {me?.org
              ? `Ask the founder of ${me.org.name} to change teams, people or company settings.`
              : "You’re not in a company yet."}
            {me?.role === "manager" && " You can invite people into the teams you lead."}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {me?.role === "manager" && (
              <Button nativeButton={false} render={<Link href="/team/invites" />}>
                Invite people
              </Button>
            )}
            <Button variant="outline" nativeButton={false} render={<Link href="/team" />}>
              Back to Team
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs"
        nativeButton={false}
        render={<Link href="/team" />}
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Team
      </Button>

      <div role="tablist" aria-label="Admin sections" className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => router.replace(`/team/admin?tab=${t.id}`, { scroll: false })}
            className={cn(
              "-mb-px h-10 border-b-2 px-3.5 text-sm transition-colors",
              tab === t.id
                ? "border-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "members" && <MembersPanel />}
        {tab === "teams" && <TeamsPanel />}
        {tab === "invites" && <InvitesPanel />}
        {tab === "settings" && <CompanySettingsPanel />}
      </div>
    </div>
  );
}
