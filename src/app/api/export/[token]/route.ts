import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const exported = await prisma.pdfExport.findUnique({
    where: { token },
  });

  if (!exported) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (new Date() > exported.expires_at) {
    // Clean up expired export
    await prisma.pdfExport.delete({ where: { id: exported.id } });
    return NextResponse.json({ error: "Link has expired" }, { status: 410 });
  }

  return new NextResponse(exported.data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${exported.filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
