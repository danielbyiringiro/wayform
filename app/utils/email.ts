// Server-side email, sent through Sankofa. Kept separate from any one route
// so the contact form and the reminder job can't drift apart on endpoint or
// sender the way they would with the call copied into each.

const SANKOFA_ENDPOINT = "https://api.trysankofa.com/v1/emails";
const FROM = process.env.CONTACT_FROM_EMAIL ?? "wayform@trysankofa.com";

export async function sendEmail(message: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const apiKey = process.env.SANKOFA_API_KEY;
  if (!apiKey) throw new Error("SANKOFA_API_KEY is not configured.");

  const res = await fetch(SANKOFA_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Sankofa returned ${res.status}: ${await res.text()}`);
  }
}
