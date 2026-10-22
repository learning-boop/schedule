import { prisma } from "@/lib/prisma";

/**
 * Keep reporting lines in step with teams: a team's lead becomes a manager
 * (if they were an employee), and everyone else in the team (except
 * founders) reports to the lead.
 */
export async function syncTeamReporting(teamId: string): Promise<void> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { lead_id: true } });
  if (!team?.lead_id) return;
  await prisma.user.updateMany({
    where: { id: team.lead_id, role: "employee" },
    data: { role: "manager" },
  });
  await prisma.user.updateMany({
    where: { team_id: teamId, id: { not: team.lead_id }, role: { not: "founder" } },
    data: { manager_id: team.lead_id },
  });
}

/** Ids of the teams this person leads */
export async function teamsLedBy(userId: string): Promise<string[]> {
  const teams = await prisma.team.findMany({ where: { lead_id: userId }, select: { id: true } });
  return teams.map((t) => t.id);
}

export function cleanTeamName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const n = name.trim().replace(/\s+/g, " ");
  return n.length >= 1 && n.length <= 60 ? n : null;
}
