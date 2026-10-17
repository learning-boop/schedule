import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await request.json();
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  }
  if (invite.expires_at < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  // Update the user with org, role, and manager from the invite
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      org_id: invite.org_id,
      role: invite.role,
      manager_id: invite.manager_id,
    },
  });

  // Delete the used invite
  await prisma.invite.delete({ where: { id: invite.id } });

  // Send welcome email
  try {
    const org = await prisma.organisation.findUnique({ where: { id: invite.org_id } });
    if (org) {
      await sendWelcomeEmail(updated.email, updated.name, org.name);
    }
  } catch (err) {
    console.error("Failed to send welcome email:", err);
  }

  return NextResponse.json({ success: true });
}
