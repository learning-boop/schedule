"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, UserPlus, UserMinus, Download, Shield, ArrowRightLeft } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Member = { id: string; name: string; email: string; role: string; manager_id: string | null };
type MeInfo = { id: string; role: string; org_id: string };

export default function AdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("employee");
  const [invManager, setInvManager] = useState("");
  const [inviting, setInviting] = useState(false);
  const [invResult, setInvResult] = useState<string | null>(null);

  // Edit member
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editManager, setEditManager] = useState("");

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    const res = await fetch("/api/team/members");
    if (res.ok) {
      const data = await res.json();
      setMe(data.me);
      const all = data.grouped.flatMap((g: { members: Member[] }) => g.members);
      setMembers(all);
    }
    setLoading(false);
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInvResult(null);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: invEmail,
        role: invRole,
        manager_id: invManager || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setInvResult(`Invite sent to ${invEmail}`);
      setInvEmail("");
    } else {
      setInvResult(data.error || "Failed to send invite");
    }
    setInviting(false);
  }

  async function updateMember() {
    if (!editId) return;
    const body: Record<string, string | null> = { userId: editId };
    if (editRole) body.role = editRole;
    body.managerId = editManager || null;

    await fetch("/api/admin/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditId(null);
    fetchMembers();
  }

  async function removeMember(userId: string, name: string) {
    if (!confirm(`Remove ${name} from the organisation?`)) return;
    await fetch(`/api/admin/members?userId=${userId}`, { method: "DELETE" });
    fetchMembers();
  }

  function exportData() {
    window.open("/api/admin/export", "_blank");
  }

  const managers = members.filter((m) => m.role === "manager" || m.role === "founder");

  if (loading) {
    return (
      <>
        <TopBar title="Admin" />
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </>
    );
  }

  if (me?.role !== "founder") {
    return (
      <>
        <TopBar title="Admin" />
        <div className="p-6">
          <p className="text-sm text-destructive">Founders only.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Admin" />
      <div className="mx-auto w-full max-w-3xl p-6 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          render={<Link href="/team" />}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to team
        </Button>

        {/* Invite */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" /> Invite Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={sendInvite} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Email"
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  required
                  className="h-8 text-sm flex-1"
                />
                <Select value={invRole} onValueChange={(v) => v && setInvRole(v)}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {invRole === "employee" && (
                <Select value={invManager} onValueChange={(v) => setInvManager(v ?? "")}>
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="Assign manager (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No manager</SelectItem>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button type="submit" size="sm" disabled={inviting}>
                {inviting ? "Sending..." : "Send Invite"}
              </Button>
              {invResult && (
                <p
                  className={`text-xs ${invResult.startsWith("Invite") ? "text-green-600" : "text-destructive"}`}
                >
                  {invResult}
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Shield className="h-4 w-4" /> Members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-md border p-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.name}
                    {m.id === me?.id && (
                      <span className="text-xs text-muted-foreground ml-1">(you)</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{m.email}</p>
                </div>
                <span className="text-[10px] rounded-full border px-1.5 py-0.5">{m.role}</span>

                {m.id !== me?.id && (
                  <>
                    {editId === m.id ? (
                      <div className="flex items-center gap-1">
                        <Select value={editRole} onValueChange={(v) => v && setEditRole(v)}>
                          <SelectTrigger size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={editManager} onValueChange={(v) => setEditManager(v ?? "")}>
                          <SelectTrigger size="sm">
                            <SelectValue placeholder="Manager" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No manager</SelectItem>
                            {managers
                              .filter((mg) => mg.id !== m.id)
                              .map((mg) => (
                                <SelectItem key={mg.id} value={mg.id}>
                                  {mg.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={updateMember}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setEditId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => {
                            setEditId(m.id);
                            setEditRole(m.role);
                            setEditManager(m.manager_id ?? "");
                          }}
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => removeMember(m.id, m.name)}
                        >
                          <UserMinus className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Export */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Download className="h-4 w-4" /> Data Export
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Download all company data (users, goals, schedules, plans) as JSON.
            </p>
            <Button size="sm" variant="outline" onClick={exportData}>
              <Download className="mr-1 h-3.5 w-3.5" /> Export All Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
