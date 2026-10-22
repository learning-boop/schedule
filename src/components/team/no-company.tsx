"use client";

import { useMe } from "@/hooks/use-me";
import { CompanySetup } from "@/components/onboarding/company-setup";

/**
 * Shown on team pages when the signed-in user isn't in a company yet:
 * join the company that invited them, or start one.
 */
export function NoCompany() {
  const me = useMe();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">You’re not in a company yet</h2>
        <p className="text-sm text-muted-foreground">
          The team calendar, booking meetings, the Right Now board and team PDF exports work inside
          a company.
        </p>
      </div>
      <CompanySetup email={me?.email} />
    </div>
  );
}
