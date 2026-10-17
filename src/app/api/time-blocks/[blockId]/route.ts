import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ blockId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId } = await params;
  const body = await request.json();
  const { title, goal_id, start, end, done, work_note, category } = body;

  const result = await prisma.timeBlock.updateMany({
    where: { id: blockId, user_id: user.id },
    data: {
      ...(title !== undefined && { title }),
      ...(goal_id !== undefined && { goal_id: goal_id || null }),
      ...(start !== undefined && { start: new Date(start) }),
      ...(end !== undefined && { end: new Date(end) }),
      ...(done !== undefined && { done }),
      ...(work_note !== undefined && { work_note }),
      ...(category !== undefined && { category }),
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.timeBlock.findUnique({
    where: { id: blockId },
    include: { goal: { select: { title: true, colour: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ blockId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId } = await params;
  await prisma.timeBlock.deleteMany({ where: { id: blockId, user_id: user.id } });

  return NextResponse.json({ success: true });
}
