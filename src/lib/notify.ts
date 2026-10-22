import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type NotificationType =
  "meeting_invite" | "meeting_response" | "meeting_moved" | "meeting_cancelled" | "member_joined";

export type NewNotification = {
  user_id: string;
  type: NotificationType;
  actor_id?: string | null;
  meeting_id?: string | null;
  /** A snapshot shown in the list (title, times, …) so it still reads well if the meeting changes */
  data: Record<string, unknown>;
};

export async function notify(entries: NewNotification[]): Promise<void> {
  const rows = entries.filter((e) => e.user_id && e.user_id !== e.actor_id);
  if (rows.length === 0) return;
  await prisma.notification.createMany({
    data: rows.map((e) => ({
      user_id: e.user_id,
      type: e.type,
      actor_id: e.actor_id ?? null,
      meeting_id: e.meeting_id ?? null,
      data: e.data as Prisma.InputJsonValue,
    })),
  });
}
