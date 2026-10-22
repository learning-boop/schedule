"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Mail, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InviteTeam = { id: string; name: string };
type Row = { email: string; role: "employee" | "manager"; team_id: string };
type Result = {
  email: string;
  ok: boolean;
  error?: string;
  invite?: { id: string; link: string; emailed: boolean; email_failed?: boolean };
};

const emptyRow = (teamId = ""): Row => ({ email: "", role: "employee", team_id: teamId });
const EMAIL_RE = /[^\s,;<>()]+@[^\s,;<>()]+\.[^\s,;<>()]+/g;

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied — share it on WhatsApp, Slack or email");
  } catch {
    window.prompt("Copy this invite link:", text);
  }
}

/** Rows of email · role · team, sent together. Shows each person's private link afterwards. */
export function InvitePeopleForm({
  teams,
  canInviteManagers,
  defaultTeamId = "",
  requireTeam = false,
  onSent,
  submitLabel,
}: {
  teams: InviteTeam[];
  canInviteManagers: boolean;
  defaultTeamId?: string;
  /** Team leads must pick one of their teams */
  requireTeam?: boolean;
  onSent?: () => void;
  submitLabel?: (count: number) => string;
}) {
  const [rows, setRows] = useState<Row[]>([emptyRow(defaultTeamId)]);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasted, setPasted] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(true);

  const filled = rows.filter((r) => r.email.trim());

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  function applyPaste() {
    const emails = [...new Set((pasted.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))];
    if (emails.length === 0) {
      toast.error("No email addresses found");
      return;
    }
    const base = rows.filter((r) => r.email.trim());
    setRows([...base, ...emails.map((email) => ({ ...emptyRow(defaultTeamId), email }))]);
    setPasted("");
    setPasteMode(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (filled.length === 0) return;
    if (requireTeam && filled.some((r) => !r.team_id)) {
      toast.error("Pick a team for everyone");
      return;
    }
    setSending(true);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invites: filled.map((r) => ({
          email: r.email.trim(),
          role: r.role,
          team_id: r.team_id || null,
        })),
      }),
    });
    setSending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Couldn’t send the invites");
      return;
    }
    setResults(data.results);
    setEmailConfigured(!!data.email_configured);
    const okCount = (data.results as Result[]).filter((r) => r.ok).length;
    if (okCount) {
      toast.success(`${okCount} ${okCount === 1 ? "invite" : "invites"} ready`);
      onSent?.();
    }
    // Keep only the rows that failed, so they can be fixed and sent again
    const failed = new Set(
      (data.results as Result[]).filter((r) => !r.ok).map((r) => r.email.toLowerCase()),
    );
    const keep = filled.filter((r) => failed.has(r.email.trim().toLowerCase()));
    setRows(keep.length ? keep : [emptyRow(defaultTeamId)]);
  }

  const selectCls =
    "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="space-y-4">
      <form onSubmit={send} className="space-y-3">
        <div className="overflow-x-auto">
          <div className="min-w-[520px] space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_130px_160px_36px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Work email</span>
              <span>Role</span>
              <span>Team</span>
              <span />
            </div>
            {rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_130px_160px_36px] items-center gap-2"
              >
                <input
                  type="email"
                  aria-label={`Email ${i + 1}`}
                  value={r.email}
                  onChange={(e) => update(i, { email: e.target.value })}
                  placeholder="name@company.com"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <select
                  aria-label={`Role ${i + 1}`}
                  value={r.role}
                  onChange={(e) => update(i, { role: e.target.value as Row["role"] })}
                  className={selectCls}
                  disabled={!canInviteManagers}
                >
                  <option value="employee">Employee</option>
                  {canInviteManagers && <option value="manager">Manager</option>}
                </select>
                <select
                  aria-label={`Team ${i + 1}`}
                  value={r.team_id}
                  onChange={(e) => update(i, { team_id: e.target.value })}
                  className={selectCls}
                >
                  {!requireTeam && <option value="">No team</option>}
                  {requireTeam && !r.team_id && <option value="">Choose team</option>}
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Remove row"
                  onClick={() =>
                    setRows((rs) =>
                      rs.length > 1 ? rs.filter((_, k) => k !== i) : [emptyRow(defaultTeamId)],
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {pasteMode ? (
          <div className="space-y-2">
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Paste emails — separated by commas, spaces or new lines"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={applyPaste}>
                Add these
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPasteMode(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 text-[13px] font-medium">
            <button
              type="button"
              onClick={() =>
                setRows((rs) => [...rs, emptyRow(rs[rs.length - 1]?.team_id ?? defaultTeamId)])
              }
              className="flex items-center gap-1 text-[#1967d2] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add another
            </button>
            <button
              type="button"
              onClick={() => setPasteMode(true)}
              className="text-[#1967d2] hover:underline"
            >
              Paste a list of emails
            </button>
          </div>
        )}

        <Button type="submit" disabled={sending || filled.length === 0} className="h-10 px-5">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {submitLabel
            ? submitLabel(filled.length)
            : filled.length > 1
              ? `Invite ${filled.length} people`
              : "Send invite"}
        </Button>
      </form>

      {results && results.length > 0 && (
        <div className="space-y-2 rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">
            {!emailConfigured
              ? "Email isn’t set up yet, so copy each private link and share it on WhatsApp, Slack or email."
              : results.some((r) => r.invite?.email_failed)
                ? "Some emails couldn’t be sent — copy those links and share them yourself."
                : "Invites were emailed. You can also copy each private link and share it yourself."}
          </p>
          <ul className="space-y-1.5">
            {results.map((r) => (
              <li key={r.email} className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    r.ok ? "bg-[#e6f4ea] text-[#137333]" : "bg-[#fce8e6] text-[#a50e0e]",
                  )}
                >
                  {r.ok ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <X className="h-3 w-3" strokeWidth={3} />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{r.email}</span>
                {r.invite?.emailed && (
                  <span className="text-xs text-muted-foreground">Emailed</span>
                )}
                {r.invite?.email_failed && (
                  <span className="text-xs font-medium text-[#b06000]">Not emailed</span>
                )}
                {r.ok && r.invite ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => copyText(r.invite!.link)}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </Button>
                ) : (
                  <span className="text-xs text-destructive">{r.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
