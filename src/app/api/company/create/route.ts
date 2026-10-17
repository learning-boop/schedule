import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/** POST /api/company/create — founder creates an organisation during signup */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (dbUser.org_id)
    return NextResponse.json({ error: "Already in an organisation" }, { status: 400 });

  const body = await request.json();
  const { name } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Company name required" }, { status: 400 });

  const org = await prisma.organisation.create({
    data: {
      name: name.trim(),
      seats: 5,
    },
  });

  // Make this user the founder
  await prisma.user.update({
    where: { id: user.id },
    data: { org_id: org.id, role: "founder" },
  });

  return NextResponse.json(org);
}
