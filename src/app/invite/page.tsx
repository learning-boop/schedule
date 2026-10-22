"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Older invite links (/invite?token=…) open the invite page */
export default function OldInviteLink() {
  return (
    <Suspense fallback={null}>
      <Redirect />
    </Suspense>
  );
}

function Redirect() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  useEffect(() => {
    router.replace(token ? `/invite/${encodeURIComponent(token)}` : "/login");
  }, [router, token]);
  return null;
}
