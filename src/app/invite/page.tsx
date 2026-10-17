"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"checking" | "ready" | "accepting" | "error">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Redirect to signup, then back here
        router.push(`/signup?next=/invite?token=${token}`);
        return;
      }

      if (!token) {
        setError("No invite token provided");
        setStatus("error");
        return;
      }

      setStatus("ready");
    }
    check();
  }, [token, router]);

  async function acceptInvite() {
    setStatus("accepting");
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to accept invite");
      setStatus("error");
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking invite...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <Button className="mt-4" onClick={() => router.push("/")}>
            Go home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="rounded-lg border bg-card p-6 text-center shadow-sm">
        <h1 className="mb-4 text-xl font-semibold">You have been invited</h1>
        <p className="mb-6 text-muted-foreground">Click below to join the organisation.</p>
        <Button onClick={acceptInvite} disabled={status === "accepting"}>
          {status === "accepting" ? "Joining..." : "Accept invite"}
        </Button>
      </div>
    </div>
  );
}
