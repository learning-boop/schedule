"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Create an account. The company is set up afterwards on the Welcome screen
 * (join the company that invited you, or start a new one) — that works whether
 * or not Supabase asks people to confirm their email first.
 */
export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  // Invite emails used to link here; the invite page now handles joining
  useEffect(() => {
    if (inviteToken) router.replace(`/invite/${encodeURIComponent(inviteToken)}`);
  }, [inviteToken, router]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome`,
      },
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    if (data.session) {
      router.push("/welcome");
      router.refresh();
    } else if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError("An account with this email already exists. Sign in instead.");
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-6 shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e6f4ea] text-[#137333]">
          <MailCheck className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <b className="text-foreground">{email}</b>. Open it to
          finish setting up — then you can start your company or join your team.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h1 className="mb-1 text-center text-2xl font-semibold">Create account</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Next, you’ll start your company or join your team.
      </p>

      <form onSubmit={handleSignup} className="space-y-4">
        <Input
          type="text"
          placeholder="Full name"
          aria-label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          type="email"
          placeholder="Email"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password (at least 8 characters)"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
