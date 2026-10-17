import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** GET /api/team/goal-templates — list templates for the org */
export async function GET() {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const templates = await prisma.goalTemplate.findMany({
    where: { org_id: me.org_id },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json(templates);
}

/** POST /api/team/goal-templates — founder creates a template */
export async function POST(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const body = await request.json();
  const { title, colour, actions } = body;

  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const template = await prisma.goalTemplate.create({
    data: {
      org_id: me.org_id,
      created_by: me.id,
      title,
      colour: colour || "#6366f1",
      actions: Array.isArray(actions) ? actions : [],
    },
  });

  return NextResponse.json(template);
}

/** DELETE /api/team/goal-templates — founder deletes a template */
export async function DELETE(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.goalTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
