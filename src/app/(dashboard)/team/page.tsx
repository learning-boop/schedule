"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Users, ChevronRight } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Member = { id: string; name: string; email: string; role: string; manager_id: string | null };
type Group = { managerId: string | null; managerName: string | null; members: Member[] };
type MeInfo = { id: string; role: string; org_id: string };
type OrgInfo = { name: string; planner_visibility: string; allow_comments: boolean };

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(
        `/api/team/members${search ? `?q=${encodeURIComponent(search)}` : ""}`,
      );
      if (res.ok) {
        const data = await res.json();
        setGroups(data.grouped);
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

  return (
    <>
      <TopBar title="Team" />
      <div className="mx-auto w-full max-w-3xl p-6 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search colleagues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        {/* Quick links */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            render={<Link href="/team/now" />}
          >
            Right Now Board
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            render={<Link href="/team/week" />}
          >
            Team Week
          </Button>
          {me && (me.role === "manager" || me.role === "founder") && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              render={<Link href="/team/dashboard" />}
            >
              Dashboard
            </Button>
          )}
          {me?.role === "founder" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                render={<Link href="/team/settings" />}
              >
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                render={<Link href="/team/admin" />}
              >
                Admin
              </Button>
            </>
          )}
        </div>

        {/* Org info */}
        {org && (
          <p className="text-xs text-muted-foreground">
            {org.name} &middot; Visibility: {org.planner_visibility} &middot; Comments:{" "}
            {org.allow_comments ? "on" : "off"}
          </p>
        )}

        {/* Members grouped by manager */}
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No colleagues found.</p>
        )}

        {groups.map((g) => (
          <Card key={g.managerId ?? "ungrouped"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {g.managerName ? `${g.managerName}'s team` : "No manager"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {g.members.map((m) => (
                <Link
                  key={m.id}
                  href={m.id === me?.id ? "/calendar" : `/team/${m.id}`}
                  className="flex items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.name}
                      {m.id === me?.id && (
                        <span className="text-xs text-muted-foreground ml-1">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  <span className="text-[10px] rounded-full border px-1.5 py-0.5 text-muted-foreground">
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
