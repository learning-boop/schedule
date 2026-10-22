"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CalendarX2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials, personColour } from "@/components/calendar/gcal";
import { fmtAgo, fmtMeetingWhen } from "@/lib/format";
import { emitCalendarRefresh, onNotificationsRefresh } from "@/lib/app-events";

type Item = {
  id: string;
  type:
    "meeting_invite" | "meeting_response" | "meeting_moved" | "meeting_cancelled" | "member_joined";
  data: {
    title?: string;
    start?: string;
    end?: string;
    response?: "accepted" | "declined";
    note?: string | null;
    removed?: boolean;
    name?: string;
    org?: string;
    team?: string | null;
  };
  read: boolean;
  created_at: string;
  actor: { id: string; name: string } | null;
  meeting_id: string | null;
  my_response: "pending" | "accepted" | "declined" | null;
};

function hashColour(id: string | undefined) {
  let h = 0;
  for (const c of id ?? "") h = (h * 31 + c.charCodeAt(0)) | 0;
  return personColour(Math.abs(h));
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setItems(data.items);
    setUnread(data.unread);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load of an external source
    load();
    const id = setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const off = onNotificationsRefresh(load);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      off();
    };
  }, [load]);

  async function markRead(ids?: string[]) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    });
    load();
  }

  async function respond(item: Item, response: "accepted" | "declined") {
    if (!item.meeting_id) return;
    setBusy(item.id + response);
    const res = await fetch(`/api/meetings/${item.meeting_id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Couldn’t send your reply");
      return;
    }
    toast.success(
      response === "accepted" ? "Added to your calendar" : "Declined — the organiser will be told",
    );
    emitCalendarRefresh();
    if (!item.read) await markRead([item.id]);
    else load();
  }

  function openItem(item: Item) {
    if (!item.read) markRead([item.id]);
    const meetingExists =
      item.meeting_id &&
      (item.type === "meeting_response" ||
        (item.my_response !== null && item.type !== "meeting_cancelled"));
    setOpen(false);
    if (meetingExists) router.push(`/calendar?meeting=${item.meeting_id}`);
    else if (item.type === "member_joined") router.push("/team");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative rounded-full", open && "bg-[#e8f0fe] text-[#174ea6]")}
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          />
        }
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-[#c5221f] px-1 text-center text-[10px] leading-4 font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[380px] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Notifications</h2>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markRead()}
              className="text-[13px] font-medium text-[#1967d2] hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        <ul className="max-h-[min(70svh,520px)] overflow-y-auto">
          {items.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing yet. Meeting invites and replies show up here.
            </li>
          )}
          {items.map((item) => {
            const who = item.actor?.name ?? "Someone";
            const title = item.data.title ?? "a meeting";
            const when =
              item.data.start && item.data.end
                ? fmtMeetingWhen(item.data.start, item.data.end, "short")
                : "";
            const needsReply =
              (item.type === "meeting_invite" || item.type === "meeting_moved") &&
              item.my_response === "pending";
            let text: React.ReactNode;
            switch (item.type) {
              case "meeting_invite":
                text = (
                  <>
                    <b>{who}</b> invited you to <b>{title}</b>
                  </>
                );
                break;
              case "meeting_moved":
                text = (
                  <>
                    <b>{who}</b> moved <b>{title}</b>
                  </>
                );
                break;
              case "meeting_response":
                text = (
                  <>
                    <b>{who}</b> {item.data.response === "accepted" ? "accepted" : "declined"}{" "}
                    <b>{title}</b>
                  </>
                );
                break;
              case "meeting_cancelled":
                text = item.data.removed ? (
                  <>
                    <b>{who}</b> removed you from <b>{title}</b>
                  </>
                ) : (
                  <>
                    <b>{who}</b> cancelled <b>{title}</b>
                  </>
                );
                break;
              case "member_joined":
                text = (
                  <>
                    <b>{item.data.name ?? who}</b> joined {item.data.org ?? "your company"}
                  </>
                );
                break;
            }
            return (
              <li
                key={item.id}
                className={cn(
                  "border-b last:border-b-0",
                  !item.read && "bg-[#f0f6ff] dark:bg-[#1967d2]/10",
                )}
              >
                <div className="flex gap-3 px-4 py-3">
                  {item.type === "member_joined" ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <UserPlus className="h-4 w-4" />
                    </span>
                  ) : item.type === "meeting_cancelled" ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <CalendarX2 className="h-4 w-4" />
                    </span>
                  ) : (
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: hashColour(item.actor?.id) }}
                    >
                      {initials(who)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className="flex w-full gap-2 text-left text-sm"
                    >
                      <span className="flex-1">{text}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {fmtAgo(item.created_at)}
                      </span>
                    </button>
                    {when && <p className="text-[13px] text-muted-foreground">{when}</p>}
                    {item.type === "member_joined" && item.data.team && (
                      <p className="text-[13px] text-muted-foreground">{item.data.team} team</p>
                    )}
                    {item.data.note && (
                      <p className="rounded-lg rounded-tl-sm bg-muted px-2.5 py-1.5 text-[13px]">
                        “{item.data.note}”
                      </p>
                    )}
                    {needsReply && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          className="h-8 rounded-full bg-[#1967d2] px-4 text-white hover:bg-[#174ea6]"
                          disabled={!!busy}
                          onClick={() => respond(item, "accepted")}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full px-4"
                          disabled={!!busy}
                          onClick={() => respond(item, "declined")}
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-full px-2 text-[#1967d2]"
                          onClick={() => openItem(item)}
                        >
                          Details
                        </Button>
                      </div>
                    )}
                    {(item.type === "meeting_invite" || item.type === "meeting_moved") &&
                      item.my_response &&
                      item.my_response !== "pending" && (
                        <p className="text-xs text-muted-foreground">
                          {item.my_response === "accepted" ? "You accepted" : "You declined"}
                        </p>
                      )}
                    {(item.type === "meeting_invite" || item.type === "meeting_moved") &&
                      item.my_response === null && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <AlertTriangle className="h-3 w-3" /> No longer on your calendar
                        </p>
                      )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
