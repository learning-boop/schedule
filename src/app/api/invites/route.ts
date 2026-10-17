import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { organisation: true },
  });
  if (!currentUser || !currentUser.org_id) {
    return NextResponse.json({ error: "No organisation" }, { status: 400 });
  }

  // Role check: founders can invite anyone; managers can only invite employees
  if (currentUser.role !== "founder" && currentUser.role !== "manager") {
    return NextResponse.json({ error: "Only founders and managers can invite" }, { status: 403 });
  }

  const body = await request.json();
  const { email, role, manager_id } = body;

  if (!email || !role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 });
  }

  // Managers can only invite employees under themselves
  if (currentUser.role === "manager") {
    if (role !== "employee") {
      return NextResponse.json({ error: "Managers can only invite employees" }, { status: 403 });
    }
  }

  // Seat limit check
  const org = currentUser.organisation!;
  const currentMembers = await prisma.user.count({ where: { org_id: org.id } });
  const pendingInvites = await prisma.invite.count({
    where: { org_id: org.id, expires_at: { gt: new Date() } },
  });

  if (currentMembers + pendingInvites >= org.seats) {
    return NextResponse.json(
      {
        error: `Seat limit reached (${org.seats}). Remove a member or upgrade to invite more.`,
        seats: org.seats,
        used: currentMembers,
        pending: pendingInvites,
      },
      { status: 403 },
    );
  }

  const invite = await prisma.invite.create({
    data: {
      org_id: currentUser.org_id,
      email,
      role,
      manager_id: currentUser.role === "manager" ? currentUser.id : manager_id || null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Send invite email (don't block on failure)
  try {
    await sendInviteEmail(email, currentUser.name, org.name, invite.token);
  } catch (err) {
    console.error("Failed to send invite email:", err);
  }

  return NextResponse.json({ invite });
}
