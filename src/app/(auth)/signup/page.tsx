"use client";

import { Suspense, lazy } from "react";

const SignupForm = lazy(() =>
  import("@/components/auth/signup-form").then((m) => ({ default: m.SignupForm })),
);

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground text-center">Loading...</p>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
