import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

/** POST /api/account/delete — user requests deletion of all their data */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // If founder, prevent deletion if org still has other members
  if (dbUser.role === "founder" && dbUser.org_id) {
    const otherMembers = await prisma.user.count({
      where: { org_id: dbUser.org_id, id: { not: user.id } },
    });
    if (otherMembers > 0) {
      return NextResponse.json(
        { error: "Transfer ownership or remove all members before deleting your account." },
        { status: 400 },
      );
    }
    // If founder is last member, delete the org too
    await prisma.organisation.delete({ where: { id: dbUser.org_id } });
  }

  // Cascade deletes handle goals, time_blocks, daily_pages, weekly_plans, monthly_plans, pdf_exports
  await prisma.user.delete({ where: { id: user.id } });

  // Delete the Supabase auth user
  try {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(user.id);
  } catch (err) {
    console.error("Failed to delete auth user:", err);
  }

  return NextResponse.json({ ok: true });
}
