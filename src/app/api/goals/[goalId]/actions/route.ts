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

  const goal = await prisma.goal.findFirst({ where: { id: goalId, user_id: user.id } });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { title } = body;

  const maxOrder = await prisma.action.aggregate({
    where: { goal_id: goalId },
    _max: { order: true },
  });

  const action = await prisma.action.create({
    data: {
      goal_id: goalId,
      title,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json(action);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, title, done } = body;

  const action = await prisma.action.findUnique({
    where: { id },
    include: { goal: { select: { user_id: true } } },
  });
  if (!action || action.goal.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.action.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
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

  const action = await prisma.action.findUnique({
    where: { id },
    include: { goal: { select: { user_id: true } } },
  });
  if (!action || action.goal.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.action.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
