import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM = process.env.EMAIL_FROM ?? "Schedule Planner <noreply@resend.dev>";

export async function sendInviteEmail(
  to: string,
  inviterName: string,
  orgName: string,
  token: string,
) {
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/signup?invite=${token}`;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `You're invited to join ${orgName} on Schedule Planner`,
    html: `
      <h2>You've been invited!</h2>
      <p><strong>${inviterName}</strong> invited you to join <strong>${orgName}</strong> on Schedule Planner.</p>
      <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none">Accept Invite</a></p>
      <p style="color:#888;font-size:12px">This invite expires in 7 days.</p>
    `,
  });
}

export async function sendWelcomeEmail(to: string, name: string, orgName: string) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Welcome to ${orgName}!`,
    html: `
      <h2>Welcome, ${name}!</h2>
      <p>You've joined <strong>${orgName}</strong> on Schedule Planner.</p>
      <p>Get started by setting your goals and planning your first week.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none">Open Planner</a></p>
    `,
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
  const goalRows = summary.goalsProgress.map((g) => `<li>${g.title}: ${g.progress}%</li>`).join("");

  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Your Weekly Summary - Schedule Planner",
    html: `
      <h2>Weekly Summary for ${name}</h2>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px;font-weight:bold">Hours worked</td><td style="padding:4px 12px">${summary.hoursWorked}h</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold">Blocks completed</td><td style="padding:4px 12px">${summary.blocksDone}</td></tr>
      </table>
      ${goalRows ? `<h3>Goals</h3><ul>${goalRows}</ul>` : ""}
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reports" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none">View Full Reports</a></p>
    `,
  });
}
