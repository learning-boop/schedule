"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    setError(null);

    const res = await fetch("/api/account/delete", { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to delete account");
      setDeleting(false);
      return;
    }

    // Sign out and redirect
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      <TopBar title="Account" />
      <div className="mx-auto w-full max-w-xl p-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Account Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Manage your account. View our{" "}
              <a href="/privacy" className="underline">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" className="underline">
                Terms of Service
              </a>
              .
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Delete Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              This will permanently delete your account and all data: goals, schedules, daily pages,
              weekly and monthly plans, and exported PDFs. This action cannot be undone.
            </p>
            <p className="text-xs text-muted-foreground">
              If you are a company founder, you must first remove all team members.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium">Type DELETE to confirm:</p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="h-8 text-sm"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              variant="destructive"
              size="sm"
              disabled={confirmText !== "DELETE" || deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : "Delete My Account & All Data"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
