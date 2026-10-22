import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/** Get the authenticated user + their DB row (with org). Returns null if not logged in. */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { organisation: true },
  });
  if (dbUser || !user.email) return dbUser;

  // The database trigger normally creates this row at sign-up; create it here
  // if it is missing so a new account never ends up half set up.
  try {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      (typeof meta.name === "string" && meta.name.trim()) ||
      (typeof meta.full_name === "string" && meta.full_name.trim()) ||
      user.email.split("@")[0];
    return await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, email: user.email.toLowerCase(), name },
      include: { organisation: true },
    });
  } catch (err) {
    console.error("Could not create the user row:", err);
    return null;
  }
}

export type AuthUser = NonNullable<Awaited<ReturnType<typeof getAuthUser>>>;

/** JSON error helper for route handlers */
export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

/** Check if the viewer is in the same org as the target user. Returns the target user or null. */
export async function getColleague(
  viewerId: string,
  viewerOrgId: string | null,
  targetUserId: string,
) {
  if (!viewerOrgId) return null;
  if (viewerId === targetUserId) return null; // Use own routes for self

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!target || target.org_id !== viewerOrgId) return null;
  return target;
}

/** Check if user is a manager of the target, or a founder */
export function canManage(
  viewerRole: string,
  viewerId: string,
  targetManagerId: string | null,
): boolean {
  if (viewerRole === "founder") return true;
  if (viewerRole === "manager" && targetManagerId === viewerId) return true;
  return false;
}
