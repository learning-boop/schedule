"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Building2, Clock, Loader2, Lock, MailCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { refreshMe } from "@/hooks/use-me";
import { getBrowserTimeZone } from "@/lib/date-utils";

type Lookup =
  | { status: "invalid" }
  | {
      status: "valid" | "expired" | "used" | "revoked";
      email: string;
      org: { name: string };
      inviter: string | null;
      role: "employee" | "manager";
      team: string | null;
      expires_at: string;
    };

type Problem =
  | { code: "email_mismatch"; signedInAs: string }
  | { code: "in_other_org"; currentOrg: string | null }
  | { code: "founder_must_handover"; message: string }
  | { code: "other"; message: string };

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-muted/40">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <InviteView />
    </Suspense>
  );
}

function InviteView() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<Lookup | null>(null);
  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  // Sign-up form
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [signingUp, setSigningUp] = useState(false);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/lookup?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then(setInvite)
      .catch(() => setInvite({ status: "invalid" }));
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, [token]);

  const join = useCallback(
    async (move = false) => {
      setJoining(true);
      setProblem(null);
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, move, tz: getBrowserTimeZone() }),
      });
      const data = await res.json().catch(() => ({}));
      setJoining(false);
      if (res.ok) {
        refreshMe();
        router.push("/team/week");
        router.refresh();
        return;
      }
      if (data.code === "email_mismatch")
        setProblem({ code: "email_mismatch", signedInAs: userEmail ?? "" });
      else if (data.code === "in_other_org")
        setProblem({ code: "in_other_org", currentOrg: data.current_org });
      else if (data.code === "founder_must_handover")
        setProblem({ code: "founder_must_handover", message: data.error });
      else setProblem({ code: "other", message: data.error || "Couldn’t join" });
    },
    [token, router, userEmail],
  );

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (!invite || invite.status !== "valid") return;
    setSignUpError(null);
    if (password.length < 8) return setSignUpError("Use at least 8 characters for your password");
    setSigningUp(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        data: { name: name.trim() || invite.email.split("@")[0] },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/invite/${token}`)}`,
      },
    });
    setSigningUp(false);
    if (error) {
      setSignUpError(
        /registered|exists/i.test(error.message)
          ? "You already have an account — sign in to join."
          : error.message,
      );
      return;
    }
    // Some Supabase projects sign people straight in, others ask them to confirm first
    if (data.session) {
      setUserEmail(invite.email);
      await join();
    } else if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setSignUpError("You already have an account — sign in to join.");
    } else {
      setCheckEmail(true);
    }
  }

  async function switchAccount() {
    await createClient().auth.signOut();
    setUserEmail(null);
    setProblem(null);
  }

  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <div className="min-h-svh bg-muted/40">
      <header className="flex h-14 items-center gap-3 border-b bg-background px-4 sm:px-6">
        <span className="text-lg font-semibold">Schedule Planner</span>
        {userEmail === null && (
          <>
            <span className="ml-auto hidden text-[13px] text-muted-foreground sm:inline">
              Already have an account?
            </span>
            <Link
              href={loginHref}
              className="ml-auto text-[13px] font-medium text-[#1967d2] hover:underline sm:ml-0"
            >
              Sign in
            </Link>
          </>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
        {!invite || userEmail === undefined ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : invite.status !== "valid" ? (
          <section className="space-y-3 rounded-2xl border bg-background p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fce8e6] text-[#a50e0e]">
              <Clock className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-semibold">This invite link no longer works</h1>
            <p className="text-sm text-muted-foreground">
              {invite.status === "used"
                ? "It has already been used."
                : invite.status === "expired"
                  ? "It has expired."
                  : "It may have been replaced by a newer link."}{" "}
              {invite.status !== "invalid" && invite.inviter
                ? `Ask ${invite.inviter} to send you a new one.`
                : "Ask the person who invited you for a new link."}
            </p>
            <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
              Go to sign in
            </Button>
          </section>
        ) : (
          <section className="space-y-5 rounded-2xl border bg-background p-6 shadow-xs sm:p-7">
            <div className="flex items-center gap-3.5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-foreground text-2xl font-semibold text-background">
                {invite.org.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-muted-foreground">You’re invited to join</p>
                <h1 className="truncate text-2xl font-semibold">{invite.org.name}</h1>
              </div>
            </div>
            <p className="text-sm">
              {invite.inviter ? <b>{invite.inviter}</b> : "Someone"} invited you to Schedule
              Planner, where your team plans the day and books time together.
            </p>
            <div className="flex flex-wrap gap-1.5 text-xs font-medium">
              <span className="rounded-full bg-muted px-2.5 py-1 capitalize">{invite.role}</span>
              {invite.team && (
                <span className="rounded-full bg-muted px-2.5 py-1">{invite.team} team</span>
              )}
            </div>

            <div className="h-px bg-border" />

            {checkEmail ? (
              <div className="space-y-2 text-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e6f4ea] text-[#137333]">
                  <MailCheck className="h-5 w-5" />
                </span>
                <h2 className="text-base font-semibold">Check your email</h2>
                <p className="text-muted-foreground">
                  We sent a confirmation link to <b className="text-foreground">{invite.email}</b>.
                  Open it to finish joining {invite.org.name}.
                </p>
              </div>
            ) : userEmail === null ? (
              <form onSubmit={signUp} className="space-y-4">
                <h2 className="text-base font-semibold">Create your account to join</h2>
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-medium">Full name</span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    className="h-10"
                  />
                </label>
                <div className="space-y-1.5">
                  <span className="text-[13px] font-medium">Email</span>
                  <span className="flex h-10 items-center gap-2 rounded-lg bg-muted px-3 text-sm">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    {invite.email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    This invite only works for this email.
                  </span>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-medium">Password</span>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="h-10"
                  />
                </label>
                {signUpError && (
                  <p className="text-sm text-destructive">
                    {signUpError}{" "}
                    {/sign in/.test(signUpError) && (
                      <Link href={loginHref} className="font-medium underline">
                        Sign in
                      </Link>
                    )}
                  </p>
                )}
                <Button type="submit" className="h-11 w-full text-[15px]" disabled={signingUp}>
                  {signingUp && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create account &amp; join
                </Button>
                <p className="text-center text-[13px] text-muted-foreground">
                  Already have an account?{" "}
                  <Link href={loginHref} className="font-medium text-[#1967d2] hover:underline">
                    Sign in to join
                  </Link>
                </p>
              </form>
            ) : problem?.code === "email_mismatch" ? (
              <div className="space-y-3 text-sm">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <UserRound className="h-4 w-4" /> Signed in with another email
                </h2>
                <p className="text-muted-foreground">
                  This invite is for <b className="text-foreground">{invite.email}</b>. You’re
                  signed in as {problem.signedInAs}.
                </p>
                <Button variant="outline" onClick={switchAccount}>
                  Switch account
                </Button>
              </div>
            ) : problem?.code === "in_other_org" ? (
              <div className="space-y-3 text-sm">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Building2 className="h-4 w-4" /> You’re already in{" "}
                  {problem.currentOrg ?? "another company"}
                </h2>
                <p className="text-muted-foreground">
                  Joining {invite.org.name} moves you there — your own planner, goals and history
                  come with you.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => join(true)} disabled={joining}>
                    {joining && <Loader2 className="h-4 w-4 animate-spin" />}
                    Move to {invite.org.name}
                  </Button>
                  <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
                    Stay
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {problem && <p className="text-sm text-destructive">{problem.message}</p>}
                <p className="text-sm text-muted-foreground">Signed in as {userEmail}</p>
                <Button
                  className="h-11 w-full bg-[#1967d2] text-[15px] text-white hover:bg-[#174ea6]"
                  onClick={() => join()}
                  disabled={joining}
                >
                  {joining && <Loader2 className="h-4 w-4 animate-spin" />}
                  Join {invite.org.name}
                </Button>
              </div>
            )}

            {!checkEmail && (
              <p className="text-xs text-muted-foreground">
                Invite expires on{" "}
                {new Date(invite.expires_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                .
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
