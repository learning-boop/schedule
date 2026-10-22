"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Mail, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  InvitePeopleForm,
  copyText,
  type InviteTeam,
} from "@/components/invites/invite-people-form";

type Invite = {
  id: string;
  email: string;
  role: "employee" | "manager";
  team: { id: string; name: string } | null;
  inviter: { id: string; name: string } | null;
  status: "waiting" | "expired";
  expires_at: string;
  created_at: string;
  link: string;
};
type Joined = {
  id: string;
  email: string;
  role: string;
  team: { id: string; name: string } | null;
  inviter: { id: string; name: string } | null;
  accepted_at: string;
  user: { id: string; name: string } | null;
};
type Data = {
  invites: Invite[];
  joined: Joined[];
  teams: (InviteTeam & { lead_id: string | null })[];
  can_invite_managers: boolean;
  email_configured: boolean;
};

function daysLeft(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d <= 1 ? "1 day left" : `${d} days left`;
}

/** Invite people, see who hasn't joined yet (copy link / resend / revoke), and who joined recently */
export function InvitesPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/invites");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Couldn’t load invites");
      return;
    }
    setError(null);
    setData(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the fetch resolves
    load();
  }, [load]);

  async function resend(inv: Invite) {
    setBusy(inv.id);
    const res = await fetch(`/api/invites/${inv.id}/resend`, { method: "POST" });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error || "Couldn’t resend");
    if (d.emailed) toast.success(`New link emailed to ${inv.email}`);
    else {
      if (d.email_failed) toast.error(`Couldn’t email ${inv.email} — share the new link yourself`);
      copyText(d.link);
    }
    load();
  }

  async function revoke(inv: Invite) {
    if (!confirm(`Remove the invite for ${inv.email}? The link will stop working.`)) return;
    setBusy(inv.id);
    const res = await fetch(`/api/invites/${inv.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return toast.error(d.error || "Couldn’t remove the invite");
    }
    toast.success("Invite removed");
    load();
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading invites…</p>;

  const isLead = !data.can_invite_managers;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">Invites</h2>
          <p className="text-[13px] text-muted-foreground">
            {isLead
              ? "Invite employees into your team. There’s no limit on how many people you invite."
              : "Founders can invite anyone; team leads can invite employees into their own team. No limit on people."}
          </p>
        </div>
        <Button className="ml-auto" onClick={() => setShowForm((s) => !s)}>
          <UserPlus className="h-4 w-4" /> Invite people
        </Button>
      </div>

      {!data.email_configured && (
        <div className="flex gap-3 rounded-xl bg-[#fef7e0] p-4 text-[13px] leading-relaxed text-[#4a2c00]">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#b06000]" />
          <div>
            <p className="font-semibold">Invite emails aren’t set up yet</p>
            <p>
              Invites still work — copy each link and send it on WhatsApp or Slack. To email them
              automatically, add an email account (a normal Gmail works) in your hosting settings:
              SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS.
            </p>
          </div>
        </div>
      )}

      {(showForm || data.invites.length === 0) && (
        <section className="rounded-xl border p-4 sm:p-5">
          {isLead && data.teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don’t lead a team yet. Ask your founder to make you a team’s lead, then you can
              invite people into it.
            </p>
          ) : (
            <InvitePeopleForm
              teams={data.teams}
              canInviteManagers={data.can_invite_managers}
              defaultTeamId={isLead ? (data.teams[0]?.id ?? "") : ""}
              requireTeam={isLead}
              onSent={load}
            />
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border">
        <div className="border-b px-4 py-3">
          <h3 className="text-[15px] font-semibold">Waiting for a reply</h3>
        </div>
        {data.invites.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No open invites.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="bg-muted/50 text-left text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Email
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Role · team
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Invited by
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.invites.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{inv.email}</td>
                    <td className="px-3 py-2.5 capitalize">
                      {inv.role}
                      {inv.team && <span className="normal-case"> · {inv.team.name}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {inv.inviter?.name ?? "—"} ·{" "}
                      {new Date(inv.created_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-full px-2.5 font-medium",
                          inv.status === "waiting"
                            ? "bg-[#e8f0fe] text-[#174ea6]"
                            : "bg-[#fce8e6] text-[#a50e0e]",
                        )}
                      >
                        {inv.status === "waiting"
                          ? `Waiting · ${daysLeft(inv.expires_at)}`
                          : "Expired"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1.5">
                        {inv.status === "waiting" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => copyText(inv.link)}
                          >
                            <Copy className="h-3.5 w-3.5" /> Copy link
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={busy === inv.id}
                          onClick={() => resend(inv)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          {inv.status === "waiting" ? "Resend" : "Send a new link"}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label={`Remove invite for ${inv.email}`}
                          disabled={busy === inv.id}
                          onClick={() => revoke(inv)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.joined.length > 0 && (
        <section className="overflow-hidden rounded-xl border">
          <div className="border-b px-4 py-3">
            <h3 className="text-[15px] font-semibold">Joined recently</h3>
          </div>
          <ul>
            {data.joined.map((j) => (
              <li
                key={j.id}
                className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{j.user?.name ?? j.email}</span>
                  <span className="block text-xs text-muted-foreground capitalize">
                    {j.role}
                    {j.team && <span className="normal-case"> · {j.team.name}</span>}
                    {j.inviter && (
                      <span className="normal-case"> · invited by {j.inviter.name}</span>
                    )}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(j.accepted_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
