"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";

/** New accounts without a company go to the Welcome screen to join or start one */
export function OnboardingRedirect() {
  const router = useRouter();
  const me = useMe();
  useEffect(() => {
    if (me && !me.org) router.replace("/welcome");
  }, [me, router]);
  return null;
}
