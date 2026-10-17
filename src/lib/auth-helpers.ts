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

  return dbUser;
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
