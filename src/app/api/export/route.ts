import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { buildExport, readExportParams } from "@/lib/pdf/export-request";

export const maxDuration = 60;

/**
 * POST /api/export — render the planner onto the original workbook pages,
 * store it and return a share link that expires in 7 days.
 * Body: { type: "day"|"week"|"month"|"goals"|"full", date?, weekStart?, month?,
 *         startDate?, endDate?, tz?, userId?, scope?: "member"|"all" }
 */
export async function POST(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const params = readExportParams(body ?? {});

  try {
    const result = await buildExport(me, params);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const exported = await prisma.pdfExport.create({
      data: {
        user_id: me.id,
        filename: result.filename,
        data: new Uint8Array(result.pdf),
        expires_at: expiresAt,
      },
    });

    return NextResponse.json({
      id: exported.id,
      token: exported.token,
      filename: exported.filename,
      expiresAt: exported.expires_at.toISOString(),
      downloadUrl: `/api/export/${exported.token}`,
    });
  } catch (err) {
    console.error("PDF export error:", err);
    return NextResponse.json({ error: "Failed to generate the PDF" }, { status: 500 });
  }
}
