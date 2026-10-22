"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { InvitesPanel } from "@/components/admin/invites-panel";
import { useMe } from "@/hooks/use-me";

/** Invite people — founders (any team) and team leads (their own team) */
export default function InvitesPage() {
  const me = useMe();
  return (
    <>
      <TopBar title="Invite people" />
      <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          nativeButton={false}
          render={<Link href="/team" />}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Team
        </Button>
        {me === undefined ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : me?.role === "employee" ? (
          <p className="text-sm text-muted-foreground">
            Only founders and team leads can invite people. Ask yours to invite your colleague.
          </p>
        ) : (
          <InvitesPanel />
        )}
      </div>
    </>
  );
}
