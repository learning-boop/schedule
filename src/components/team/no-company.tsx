"use client";

import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shown on team pages when the signed-in user isn't in a company yet.
 * Until now a company could only be created during sign-up.
 */
export function NoCompany() {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/company/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not create the company");
        setSaving(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5 text-muted-foreground" /> You&apos;re not in a company yet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The team calendar, the Right Now board and team PDF exports work inside a company. Create
          your company to become its founder, then invite your team from Team → Admin. If your
          company already uses Schedule Planner, ask your founder for an invite link instead.
        </p>
        <form onSubmit={createCompany} className="flex gap-2">
          <Input
            placeholder="Company name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9"
            maxLength={120}
            aria-label="Company name"
          />
          <Button type="submit" className="h-9" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create company"}
          </Button>
        </form>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
