/** The app's public address, for links in emails and copyable invite links */
export function appOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

export function inviteLink(origin: string, token: string): string {
  return `${origin}/invite/${encodeURIComponent(token)}`;
}
