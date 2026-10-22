"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { initials, personColour } from "@/components/calendar/gcal";

type Person = { id: string; name: string; role: string };
type Team = {
  id: string;
  name: string;
  lead: { id: string; name: string } | null;
  members: Person[];
};
type Draft = { id: string | null; name: string; leadId: string; memberIds: string[] };

/** Founder: create teams, choose a lead, move people between teams */
export function TeamsPanel() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [unassigned, setUnassigned] = useState<Person[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/teams");
    if (!res.ok) return;
    const d = await res.json();
    setTeams(d.teams);
    setUnassigned(d.unassigned);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the fetch resolves
    load();
  }, [load]);

  const people: Person[] = useMemo(() => {
    const all = [...(teams ?? []).flatMap((t) => t.members), ...unassigned];
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, unassigned]);
  const colourOf = (id: string) =>
    personColour(
      Math.max(
        0,
        people.findIndex((p) => p.id === id),
      ),
    );
  const teamOf = (id: string) => (teams ?? []).find((t) => t.members.some((m) => m.id === id));

  function edit(t: Team | null) {
    setError(null);
    setSearch("");
    setDraft(
      t
        ? {
            id: t.id,
            name: t.name,
            leadId: t.lead?.id ?? "",
            memberIds: t.members.map((m) => m.id),
          }
        : { id: null, name: "", leadId: "", memberIds: [] },
    );
  }

  async function save() {
    if (!draft) return;
    setError(null);
    if (!draft.name.trim()) return setError("Enter a team name");
    setSaving(true);
    const body = {
      name: draft.name.trim(),
      lead_id: draft.leadId || null,
      member_ids: draft.memberIds,
    };
    const res = await fetch(draft.id ? `/api/teams/${draft.id}` : "/api/teams", {
      method: draft.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error || "Couldn’t save the team");
    }
    toast.success(draft.id ? "Team saved" : "Team created");
    setDraft(null);
    load();
  }

  async function remove() {
    if (!draft?.id) return;
    if (!confirm(`Delete the ${draft.name} team? Its people stay in the company, without a team.`))
      return;
    setSaving(true);
    const res = await fetch(`/api/teams/${draft.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) return toast.error("Couldn’t delete the team");
    toast.success("Team deleted");
    setDraft(null);
    load();
  }

  if (!teams) return <p className="text-sm text-muted-foreground">Loading teams…</p>;

  const candidates = people.filter(
    (p) =>
      draft &&
      !draft.memberIds.includes(p.id) &&
      p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section aria-label="Teams" className="min-w-0 flex-[999_1_480px] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold">Teams</h2>
            <p className="text-[13px] text-muted-foreground">
              {teams.length} {teams.length === 1 ? "team" : "teams"} · {people.length} people. Teams
              group people on the team calendar; a team’s lead can invite people into it.
            </p>
          </div>
          <Button className="ml-auto" onClick={() => edit(null)}>
            <Plus className="h-4 w-4" /> New team
          </Button>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-3">
          {teams.map((t) => (
            <article
              key={t.id}
              className={cn(
                "space-y-3 rounded-xl border bg-background p-4",
                draft?.id === t.id && "border-2 border-foreground p-[15px]",
              )}
            >
              <div>
                <h3 className="font-semibold">{t.name}</h3>
                <p className="text-[13px] text-muted-foreground">Lead: {t.lead?.name ?? "none"}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="flex">
                  {t.members.slice(0, 5).map((m, i) => (
                    <span
                      key={m.id}
                      title={m.name}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white",
                        i > 0 && "-ml-2",
                      )}
                      style={{ background: colourOf(m.id) }}
                    >
                      {initials(m.name)}
                    </span>
                  ))}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {t.members.length} {t.members.length === 1 ? "person" : "people"}
                </span>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => edit(t)}>
                  Edit
                </Button>
              </div>
            </article>
          ))}
          <article className="space-y-1 rounded-xl border border-dashed bg-muted/40 p-4">
            <h3 className="font-semibold text-muted-foreground">Not in a team</h3>
            <p className="text-[13px] text-muted-foreground">
              {unassigned.length === 0
                ? "Everyone is in a team."
                : unassigned.map((p) => p.name).join(", ")}
            </p>
          </article>
        </div>
      </section>

      {draft && (
        <section
          aria-label={draft.id ? "Edit team" : "New team"}
          className="flex-[1_1_320px] space-y-4 rounded-2xl border bg-background p-5"
        >
          <div className="flex items-center">
            <h2 className="text-base font-semibold">{draft.id ? "Edit team" : "New team"}</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setDraft(null)}
              className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium">Team name</span>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              maxLength={60}
              placeholder="e.g. Design"
              className="h-10"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium">Team lead</span>
            <select
              value={draft.leadId}
              onChange={(e) => {
                const id = e.target.value;
                setDraft({
                  ...draft,
                  leadId: id,
                  memberIds:
                    id && !draft.memberIds.includes(id)
                      ? [...draft.memberIds, id]
                      : draft.memberIds,
                });
              }}
              className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="">No lead</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.role === "employee" ? " — will become a manager" : ""}
                </option>
              ))}
            </select>
            <span className="block text-xs text-muted-foreground">
              Everyone else in the team reports to the lead.
            </span>
          </label>

          <div className="space-y-2">
            <span className="text-[13px] font-medium">Members · {draft.memberIds.length}</span>
            <ul className="space-y-1.5">
              {draft.memberIds.map((id) => {
                const p = people.find((x) => x.id === id);
                if (!p) return null;
                const elsewhere = teamOf(id);
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2.5 rounded-lg border px-2 py-1.5 text-sm"
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ background: colourOf(id) }}
                    >
                      {initials(p.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {p.name}
                      {elsewhere && elsewhere.id !== draft.id && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · moves from {elsewhere.name}
                        </span>
                      )}
                    </span>
                    {draft.leadId === id ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Lead</span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Remove ${p.name} from the team`}
                        onClick={() =>
                          setDraft({ ...draft, memberIds: draft.memberIds.filter((x) => x !== id) })
                        }
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="relative">
              <span className="flex h-10 items-center gap-2 rounded-lg border px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Add people…"
                  aria-label="Add people to this team"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </span>
              {search.trim() && (
                <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                  {candidates.length === 0 && (
                    <li className="px-2 py-1.5 text-sm text-muted-foreground">No one found</li>
                  )}
                  {candidates.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({ ...draft, memberIds: [...draft.memberIds, p.id] });
                          setSearch("");
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        {p.name}
                        {teamOf(p.id) && (
                          <span className="text-xs text-muted-foreground">
                            · {teamOf(p.id)!.name}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            {draft.id && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={remove}
                disabled={saving}
              >
                Delete team
              </Button>
            )}
            <Button variant="outline" className="ml-auto" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {draft.id ? "Save changes" : "Create team"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
