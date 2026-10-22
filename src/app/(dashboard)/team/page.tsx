"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Users, ChevronRight, UserPlus } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NoCompany } from "@/components/team/no-company";
import { initials, personColour } from "@/components/calendar/gcal";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  manager_id: string | null;
  team_id: string | null;
};
type Group = {
  teamId: string | null;
  teamName: string | null;
  leadId: string | null;
  members: Member[];
};
type MeInfo = { id: string; role: string; org_id: string };
type OrgInfo = { name: string; planner_visibility: string; allow_comments: boolean };

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [noCompany, setNoCompany] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(
        `/api/team/members${search ? `?q=${encodeURIComponent(search)}` : ""}`,
      );
      if (res.status === 403) setNoCompany(true);
      if (res.ok) {
        const data = await res.json();
        setGroups(data.grouped);
        setAllMembers(data.members ?? []);
        setMe(data.me);
        setOrg(data.org);
      }
      setLoading(false);
    })();
  }, [search]);

  if (loading) {
    return (
      <>
        <TopBar title="Team" />
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </>
    );
  }

  if (noCompany) {
    return (
      <>
        <TopBar title="Team" />
        <div className="p-4 sm:p-6">
          <NoCompany />
        </div>
      </>
    );
  }

  const colourOf = (id: string) =>
    personColour(
      Math.max(
        0,
        [...allMembers]
          .sort((a, b) =>
            a.id === me?.id ? -1 : b.id === me?.id ? 1 : a.name.localeCompare(b.name),
          )
          .findIndex((m) => m.id === id),
      ),
    );
  const canInvite = me?.role === "founder" || me?.role === "manager";

  return (
    <>
      <TopBar title="Team" />
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search colleagues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-8 text-xs"
            nativeButton={false}
            render={<Link href="/team/week" />}
          >
            Team calendar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            nativeButton={false}
            render={<Link href="/team/now" />}
          >
            Right Now Board
          </Button>
          {canInvite && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              nativeButton={false}
              render={
                <Link href={me?.role === "founder" ? "/team/admin?tab=invites" : "/team/invites"} />
              }
            >
              <UserPlus className="h-3.5 w-3.5" /> Invite people
            </Button>
          )}
          {canInvite && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              nativeButton={false}
              render={<Link href="/team/dashboard" />}
            >
              Dashboard
            </Button>
          )}
          {me?.role === "founder" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              nativeButton={false}
              render={<Link href="/team/admin" />}
            >
              Admin
            </Button>
          )}
        </div>

        {/* Org info */}
        {org && (
          <p className="text-xs text-muted-foreground">
            {org.name} &middot; {allMembers.length} {allMembers.length === 1 ? "person" : "people"}{" "}
            &middot; Everyone in the company can see each other’s schedule.
          </p>
        )}

        {/* Members grouped by team */}
        {groups.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No colleagues found.</p>
        )}

        {groups.map((g) => (
          <Card key={g.teamId ?? "no-team"}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {g.teamName ?? (groups.length > 1 ? "No team" : "Everyone")}
                <span className="font-normal">· {g.members.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {g.members.map((m) => (
                <Link
                  key={m.id}
                  href={m.id === me?.id ? "/calendar" : `/team/${m.id}`}
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: colourOf(m.id) }}
                  >
                    {initials(m.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.name}
                      {m.id === me?.id && (
                        <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  {g.leadId === m.id && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      lead
                    </span>
                  )}
                  <span className="rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {m.role}
                  </span>
                  {m.id !== me?.id && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
