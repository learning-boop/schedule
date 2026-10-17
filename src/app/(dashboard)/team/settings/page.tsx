"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Trash2, Send } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Template = {
  id: string;
  title: string;
  colour: string;
  actions: string[];
  created_at: string;
};

export default function TeamSettingsPage() {
  const [visibility, setVisibility] = useState("schedule");
  const [comments, setComments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newActions, setNewActions] = useState("");
  const [pushing, setPushing] = useState<string | null>(null);

  useEffect(() => {
    // Fetch current settings
    fetch("/api/team/members")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.org) {
          setVisibility(d.org.planner_visibility);
          setComments(d.org.allow_comments);
        }
      });

    // Fetch templates
    fetch("/api/team/goal-templates")
      .then((r) => (r.ok ? r.json() : []))
      .then(setTemplates);
  }, []);

  async function saveSettings() {
    setSaving(true);
    await fetch("/api/team/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planner_visibility: visibility, allow_comments: comments }),
    });
    setSaving(false);
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const actions = newActions
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await fetch("/api/team/goal-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), actions }),
    });
    if (res.ok) {
      const t = await res.json();
      setTemplates([t, ...templates]);
      setNewTitle("");
      setNewActions("");
    }
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/team/goal-templates?id=${id}`, { method: "DELETE" });
    setTemplates(templates.filter((t) => t.id !== id));
  }

  async function pushTemplate(id: string) {
    setPushing(id);
    await fetch("/api/team/goal-templates/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: id }),
    });
    setPushing(null);
  }

  return (
    <>
      <TopBar title="Team Settings" />
      <div className="mx-auto w-full max-w-2xl p-6 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          render={<Link href="/team" />}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to team
        </Button>

        {/* Visibility settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Company Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Planner visibility</p>
              <Select value={visibility} onValueChange={(v) => v && setVisibility(v)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="schedule">
                    Schedule only (calendar, top 3, done log)
                  </SelectItem>
                  <SelectItem value="full">Full planner (includes goals, SWOT, notes)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Allow comments</p>
                <p className="text-[10px] text-muted-foreground">
                  Colleagues can comment on each other's schedule
                </p>
              </div>
              <button
                onClick={() => setComments(!comments)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  comments ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    comments ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <Button size="sm" onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Goal Templates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Goal Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Create goal templates and push them to your team. Each user gets a copy as a new goal.
            </p>

            {/* Existing templates */}
            {templates.map((t) => (
              <div key={t.id} className="flex items-start gap-2 rounded-md border p-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.actions.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Actions: {t.actions.join(", ")}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => pushTemplate(t.id)}
                  disabled={pushing === t.id}
                >
                  <Send className="mr-1 h-3 w-3" />
                  {pushing === t.id ? "Pushing..." : "Push"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => deleteTemplate(t.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}

            {/* Create new */}
            <form onSubmit={createTemplate} className="space-y-2 border-t pt-3">
              <Input
                placeholder="Goal title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-8 text-sm"
              />
              <textarea
                placeholder="Actions (one per line)"
                value={newActions}
                onChange={(e) => setNewActions(e.target.value)}
                rows={3}
                className="w-full rounded-md border px-3 py-1.5 text-sm"
              />
              <Button type="submit" size="sm" disabled={!newTitle.trim()}>
                <Plus className="mr-1 h-3 w-3" /> Create Template
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
