import { canManage } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { safeTimeZone } from "@/lib/tz";
import { collectPlannerPages, type ExportRequest, type ExportType } from "./collect";
import { renderWorkbook, type PlannerGroup } from "./workbook";

const MAX_PAGES = 600;

type Me = { id: string; name: string; role: string; org_id: string | null };

export type ExportParams = ExportRequest & {
  /** "me" (default), "member" (needs userId) or "all" (founders) */
  scope?: "me" | "member" | "all";
  userId?: string;
  tz?: string;
};

export function readExportParams(src: URLSearchParams | Record<string, unknown>): ExportParams {
  const get = (k: string) => {
    const v = src instanceof URLSearchParams ? src.get(k) : src[k];
    return typeof v === "string" && v ? v : undefined;
  };
  const scope = get("scope");
  return {
    type: (get("type") ?? "day") as ExportType,
    date: get("date"),
    weekStart: get("weekStart"),
    month: get("month"),
    startDate: get("startDate"),
    endDate: get("endDate"),
    userId: get("userId"),
    scope: scope === "all" || scope === "member" ? scope : undefined,
    tz: get("tz") ?? get("timeZone"),
  };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "planner";

/**
 * Builds the workbook PDF for the people this user may export:
 * themselves; a member (founder: anyone in the company, manager: their
 * direct reports); or everyone in the company (founders).
 */
export async function buildExport(
  me: Me,
  params: ExportParams,
): Promise<
  { ok: true; pdf: Uint8Array; filename: string } | { ok: false; status: number; error: string }
> {
  const tz = safeTimeZone(params.tz);

  let targets: { id: string; name: string }[];
  let stampOwner = false;
  let who: string;

  if (params.scope === "all") {
    if (me.role !== "founder" || !me.org_id) {
      return { ok: false, status: 403, error: "Only founders can export everyone's planner" };
    }
    targets = await prisma.user.findMany({
      where: { org_id: me.org_id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    stampOwner = true;
    who = "company";
  } else if (params.userId && params.userId !== me.id) {
    const target = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, name: true, org_id: true, manager_id: true },
    });
    if (!target || !me.org_id || target.org_id !== me.org_id) {
      return { ok: false, status: 404, error: "Member not found" };
    }
    if (!canManage(me.role, me.id, target.manager_id)) {
      return { ok: false, status: 403, error: "You can only export your own team's planners" };
    }
    targets = [{ id: target.id, name: target.name }];
    stampOwner = true;
    who = slug(target.name);
  } else {
    targets = [{ id: me.id, name: me.name }];
    who = "my";
  }

  const groups: PlannerGroup[] = [];
  let pageCount = 0;
  for (const t of targets) {
    const result = await collectPlannerPages(t.id, params, tz);
    if (!result.ok) return { ok: false, status: 400, error: result.error };
    pageCount += result.pages.length;
    if (pageCount > MAX_PAGES) {
      return { ok: false, status: 400, error: "That export is too large — choose a shorter range" };
    }
    groups.push({ owner: stampOwner ? t.name : null, pages: result.pages });
  }

  const pdf = await renderWorkbook(groups);
  const period =
    params.type === "day"
      ? (params.date ?? "")
      : params.type === "week"
        ? (params.weekStart ?? params.date ?? "")
        : params.type === "month"
          ? (params.month ?? params.date ?? "").slice(0, 7)
          : params.type === "full"
            ? `${params.startDate}-to-${params.endDate}`
            : "";
  const filename = [who, "planner", params.type, period].filter(Boolean).join("-") + ".pdf";
  return { ok: true, pdf, filename };
}
