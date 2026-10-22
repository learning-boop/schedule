"use client";

/**
 * Tiny in-page event bus so one part of the app can tell others to reload
 * (e.g. accepting an invite from the bell refreshes any open calendar).
 */
const CALENDAR = "app:calendar-refresh";
const NOTIFICATIONS = "app:notifications-refresh";

export function emitCalendarRefresh() {
  window.dispatchEvent(new Event(CALENDAR));
}

export function onCalendarRefresh(cb: () => void) {
  window.addEventListener(CALENDAR, cb);
  return () => window.removeEventListener(CALENDAR, cb);
}

export function emitNotificationsRefresh() {
  window.dispatchEvent(new Event(NOTIFICATIONS));
}

export function onNotificationsRefresh(cb: () => void) {
  window.addEventListener(NOTIFICATIONS, cb);
  return () => window.removeEventListener(NOTIFICATIONS, cb);
}

/** After anything changes a meeting: refresh calendars and the bell */
export function emitMeetingChanged() {
  emitCalendarRefresh();
  emitNotificationsRefresh();
}
