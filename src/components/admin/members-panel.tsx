"use client";

import { useCallback, useEffect, useState } from "react";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { initials, personColour } from "@/components/calendar/gcal";
import { getBrowserTimeZone } from "@/lib/date-utils";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "employee" | "manager" | "founder";
  manager_id: string | null;
  team_id: string | null;
};
type Team = { id: string; name: string; lead_id: string | null };

/** Founder: everyone in the company — team, role, who they report to, remove */
export function MembersPanel() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [meId, setMeId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/team/members");
    if (!res.ok) return;
    const d = await res.json();
    setMembers(d.members);
    setTeams(d.teams ?? []);
    setMeId(d.me?.id ?? "");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the fetch resolves
    load();
  }, [load]);

  async function update(userId: string, patch: Record<string, string | null>) {
    setBusy(userId);
    const res = await fetch("/api/admin/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch }),
    });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Couldn’t save");
    }
    load();
  }

  async function remove(m: Member) {
    if (
      !confirm(
        `Remove ${m.name} from the company? Their own planner stays with their account. Upcoming meetings they organised are cancelled.`,
      )
    )
      return;
    setBusy(m.id);
    const params = new URLSearchParams({ userId: m.id, tz: getBrowserTimeZone() });
    const res = await fetch(`/api/admin/members?${params}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Couldn’t remove");
    } else toast.success(`${m.name} was removed`);
    load();
  }

  if (!members) return <p className="text-sm text-muted-foreground">Loading members…</p>;

  const managers = members.filter((m) => m.role !== "employee");
  const select =
    "h-8 rounded-md border border-input bg-background px-2 text-[13px] disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Members · {members.length}</h2>
        <p className="text-[13px] text-muted-foreground">
          Moving someone into a team makes them report to its lead. To add people, use Invites.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr className="bg-muted/50 text-left text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Person
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Team
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Role
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Reports to
              </th>
              <th scope="col" className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const isMe = m.id === meId;
              const lead = teams.find((t) => t.lead_id === m.id);
              return (
                <tr key={m.id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{ background: personColour(i) }}
                      >
                        {initials(m.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {m.name}{" "}
                          {isMe && <span className="font-normal text-muted-foreground">(you)</span>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {m.email}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      aria-label={`${m.name}'s team`}
                      className={select}
                      value={m.team_id ?? ""}
                      disabled={busy === m.id}
                      onChange={(e) => update(m.id, { teamId: e.target.value || null })}
                    >
                      <option value="">No team</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {lead && <span className="ml-2 text-xs text-muted-foreground">Lead</span>}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      aria-label={`${m.name}'s role`}
                      className={select}
                      value={m.role}
                      disabled={isMe || busy === m.id}
                      onChange={(e) => update(m.id, { role: e.target.value })}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="founder">Founder</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      aria-label={`${m.name} reports to`}
                      className={select}
                      value={m.manager_id ?? ""}
                      disabled={busy === m.id}
                      onChange={(e) => update(m.id, { managerId: e.target.value || null })}
                    >
                      <option value="">No one</option>
                      {managers
                        .filter((x) => x.id !== m.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!isMe && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Remove ${m.name}`}
                        disabled={busy === m.id}
                        onClick={() => remove(m)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
