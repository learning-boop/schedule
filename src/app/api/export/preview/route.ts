import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { buildExport, readExportParams } from "@/lib/pdf/export-request";

export const maxDuration = 60;

/**
 * GET /api/export/preview?type=week&weekStart=YYYY-MM-DD&tz=Area/City[&userId=…|&scope=all]
 * Same PDF as POST /api/export, returned inline for viewing in the browser.
 */
export async function GET(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = readExportParams(new URL(request.url).searchParams);
  try {
    const result = await buildExport(me, params);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return new NextResponse(Buffer.from(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("PDF preview error:", err);
    return NextResponse.json({ error: "Failed to generate the PDF" }, { status: 500 });
  }
}
