import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ goalId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await params;

  // Verify ownership
  const goal = await prisma.goal.findFirst({ where: { id: goalId, user_id: user.id } });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { title, deadline } = body;

  const subGoal = await prisma.subGoal.create({
    data: {
      goal_id: goalId,
      title,
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  return NextResponse.json(subGoal);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, title, deadline, done } = body;

  // Verify ownership through goal
  const subGoal = await prisma.subGoal.findUnique({
    where: { id },
    include: { goal: { select: { user_id: true } } },
  });
  if (!subGoal || subGoal.goal.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.subGoal.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(done !== undefined && { done }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();

  const subGoal = await prisma.subGoal.findUnique({
    where: { id },
    include: { goal: { select: { user_id: true } } },
  });
  if (!subGoal || subGoal.goal.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.subGoal.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
