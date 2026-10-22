import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { safeTimeZone } from "@/lib/tz";

/**
 * Outgoing email. Works with any normal mailbox over SMTP (e.g. a Gmail
 * account + app password) or with Resend. Companies using the app never need
 * a domain of their own: everything is sent from this one account.
 *
 *   SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_USER=you@gmail.com  SMTP_PASS=<app password>
 *   EMAIL_FROM (optional) — the sending address if it differs from SMTP_USER
 *   RESEND_API_KEY (optional) — used only when SMTP isn't set up
 *
 * With neither configured, nothing is sent and invite links can be copied
 * and shared instead.
 */

type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Replies go here (e.g. the person who sent the invite) */
  replyTo?: string;
  /** Display name in the From line, e.g. "Priya Sharma via Schedule Planner" */
  fromName?: string;
};

function smtpOptions() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  let pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  // Google shows app passwords in groups ("abcd efgh ijkl mnop"); the spaces aren't part of it
  if (/(^|\.)gmail\.com$|googlemail\.com$/i.test(host)) pass = pass.replace(/\s+/g, "");
  const port = Number(process.env.SMTP_PORT || 465);
  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // Fail fast on a wrong host or port instead of hanging the request
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  };
}

export function emailConfigured(): boolean {
  return !!smtpOptions() || !!process.env.RESEND_API_KEY;
}

function senderAddress(): string {
  const from = (process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@resend.dev").trim();
  const angle = /<([^>]+)>/.exec(from);
  return angle ? angle[1].trim() : from;
}

let transporter: Transporter | null = null;

/** Send one email. Returns false when no email service is configured. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const name = (mail.fromName ?? "Schedule Planner").replace(/["<>\r\n]/g, "").slice(0, 120);
  const from = `"${name}" <${senderAddress()}>`;

  const smtp = smtpOptions();
  if (smtp) {
    transporter ??= nodemailer.createTransport(smtp);
    await transporter.sendMail({
      from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: mail.replyTo,
    });
    return true;
  }

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: mail.replyTo,
    });
    if (error) throw new Error(error.message);
    return true;
  }

  return false;
}

/** Send and never throw (logs failures). Returns whether it was sent. */
export async function trySendMail(mail: Mail): Promise<boolean> {
  try {
    return await sendMail(mail);
  } catch (err) {
    console.error("Email failed:", err);
    return false;
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Thu 22 Oct, 2:00 – 2:30 pm IST" in the given time zone */
export function formatMeetingTime(start: Date, end: Date, tz: string | null | undefined): string {
  const zone = safeTimeZone(tz);
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(start);
  const time = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" })
      .format(d)
      .replace(/\s?([AP])M/, (_, p: string) => ` ${p.toLowerCase()}m`);
  return `${day}, ${time(start)} – ${time(end)} ${zoneName(zone, end)}`;
}

/** "IST", "BST", "EDT"… — falls back to "GMT+4" where there's no common short name */
function zoneName(zone: string, at: Date): string {
  let fallback = zone;
  for (const locale of ["en-US", "en-IN", "en-GB", "en-AU"]) {
    const name = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: "short" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    if (!name) continue;
    if (!/^(GMT|UTC)[+-]/.test(name)) return name;
    if (fallback === zone) fallback = name;
  }
  return fallback;
}

function layout(bodyHtml: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f1f1f;max-width:520px">
${bodyHtml}
<p style="color:#5f6368;font-size:12px;margin-top:28px">Sent by Schedule Planner</p>
</div>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 22px;background:#1967d2;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>`;
}

export function inviteEmail(opts: {
  inviterName: string;
  orgName: string;
  role: string;
  teamName: string | null;
  link: string;
  expires: Date;
}) {
  const what = `${opts.role === "manager" ? "a manager" : "an employee"}${opts.teamName ? ` in the ${opts.teamName} team` : ""}`;
  const expires = opts.expires.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    subject: `${opts.inviterName} invited you to join ${opts.orgName} on Schedule Planner`,
    html: layout(`
<h2 style="margin:0 0 12px;font-size:20px">You’re invited to ${escapeHtml(opts.orgName)}</h2>
<p><b>${escapeHtml(opts.inviterName)}</b> invited you to join <b>${escapeHtml(opts.orgName)}</b> on Schedule Planner as ${escapeHtml(what)}.</p>
${button(opts.link, "Accept invite")}
<p style="color:#5f6368;font-size:13px">This link works once, only for this email address, until ${escapeHtml(expires)}.<br>If the button doesn’t work, open: ${escapeHtml(opts.link)}</p>`),
    text: `${opts.inviterName} invited you to join ${opts.orgName} on Schedule Planner as ${what}.\n\nAccept the invite: ${opts.link}\n\nThe link works once, only for this email address, until ${expires}.`,
  };
}

export function meetingEmail(opts: {
  kind: "invite" | "moved" | "cancelled";
  organiserName: string;
  title: string;
  when: string;
  agenda?: string | null;
  location?: string | null;
  link: string;
}) {
  const subject =
    opts.kind === "invite"
      ? `Invitation: ${opts.title} — ${opts.when}`
      : opts.kind === "moved"
        ? `Moved: ${opts.title} — now ${opts.when}`
        : `Cancelled: ${opts.title} — ${opts.when}`;
  const lead =
    opts.kind === "invite"
      ? `<b>${escapeHtml(opts.organiserName)}</b> invited you to a meeting.`
      : opts.kind === "moved"
        ? `<b>${escapeHtml(opts.organiserName)}</b> moved this meeting. Please reply again.`
        : `<b>${escapeHtml(opts.organiserName)}</b> cancelled this meeting.`;
  const details = [
    `<p style="margin:0 0 4px;font-size:18px;font-weight:600">${escapeHtml(opts.title)}</p>`,
    `<p style="margin:0 0 4px">${escapeHtml(opts.when)}</p>`,
    opts.location ? `<p style="margin:0 0 4px">Where: ${escapeHtml(opts.location)}</p>` : "",
    opts.agenda
      ? `<p style="margin:12px 0 0;white-space:pre-wrap">${escapeHtml(opts.agenda)}</p>`
      : "",
  ].join("");
  return {
    subject,
    html: layout(`
<p>${lead}</p>
<div style="padding:16px;border:1px solid #dadce0;border-radius:10px">${details}</div>
${opts.kind === "cancelled" ? "" : button(opts.link, opts.kind === "invite" ? "Reply in Schedule Planner" : "Open in Schedule Planner")}`),
    text: [
      `${opts.organiserName} ${opts.kind === "invite" ? "invited you to a meeting" : opts.kind === "moved" ? "moved this meeting" : "cancelled this meeting"}.`,
      "",
      opts.title,
      opts.when,
      opts.location ? `Where: ${opts.location}` : "",
      opts.agenda ? `\n${opts.agenda}` : "",
      opts.kind === "cancelled" ? "" : `\nOpen: ${opts.link}`,
    ]
      .filter((l) => l !== "")
      .join("\n"),
  };
}

export async function sendWelcomeEmail(to: string, name: string, orgName: string, appUrl: string) {
  await trySendMail({
    to,
    subject: `Welcome to ${orgName}!`,
    html: layout(`
<h2 style="margin:0 0 12px;font-size:20px">Welcome, ${escapeHtml(name)}!</h2>
<p>You’ve joined <b>${escapeHtml(orgName)}</b> on Schedule Planner.</p>
<p>Plan your week, and see your team’s calendar to book time with anyone.</p>
${button(appUrl, "Open Schedule Planner")}`),
    text: `Welcome, ${name}! You've joined ${orgName} on Schedule Planner.\n\nOpen: ${appUrl}`,
  });
}

export async function sendWeeklySummaryEmail(
  to: string,
  name: string,
  summary: {
    hoursWorked: number;
    blocksDone: number;
    goalsProgress: { title: string; progress: number }[];
  },
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const goalRows = summary.goalsProgress
    .map((g) => `<li>${escapeHtml(g.title)}: ${g.progress}%</li>`)
    .join("");

  await sendMail({
    to,
    subject: "Your Weekly Summary - Schedule Planner",
    html: layout(`
<h2 style="margin:0 0 12px;font-size:20px">Weekly Summary for ${escapeHtml(name)}</h2>
<table style="border-collapse:collapse;margin:16px 0">
  <tr><td style="padding:4px 12px;font-weight:bold">Hours worked</td><td style="padding:4px 12px">${summary.hoursWorked}h</td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold">Blocks completed</td><td style="padding:4px 12px">${summary.blocksDone}</td></tr>
</table>
${goalRows ? `<h3>Goals</h3><ul>${goalRows}</ul>` : ""}
${button(`${appUrl}/reports`, "View full reports")}`),
    text: `Weekly summary for ${name}: ${summary.hoursWorked}h worked, ${summary.blocksDone} blocks completed.\n\n${appUrl}/reports`,
  });
}
