import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = (await request.json()) as { ids: string[] };
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  await Promise.all(
    ids.map((id, index) =>
      prisma.goal.updateMany({
        where: { id, user_id: user.id },
        data: { rank: index },
      }),
    ),
  );

  return NextResponse.json({ success: true });
}
