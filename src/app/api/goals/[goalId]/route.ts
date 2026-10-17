import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ goalId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await params;
  const body = await request.json();
  const { title, deadline, colour, status } = body;

  const goal = await prisma.goal.updateMany({
    where: { id: goalId, user_id: user.id },
    data: {
      ...(title !== undefined && { title }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(colour !== undefined && { colour }),
      ...(status !== undefined && { status }),
    },
  });

  if (goal.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.goal.findUnique({
    where: { id: goalId },
    include: { sub_goals: true, actions: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ goalId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await params;
  await prisma.goal.deleteMany({ where: { id: goalId, user_id: user.id } });

  return NextResponse.json({ success: true });
}
