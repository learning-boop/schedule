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
  const goal = await prisma.goal.findFirst({ where: { id: goalId, user_id: user.id } });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { ids } = (await request.json()) as { ids: string[] };

  await Promise.all(
    ids.map((id, index) =>
      prisma.action.updateMany({
        where: { id, goal_id: goalId },
        data: { order: index },
      }),
    ),
  );

  return NextResponse.json({ success: true });
}
