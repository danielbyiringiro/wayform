import { NextRequest } from "next/server";

// Contact form delivery, sent through Sankofa (api.itemeshop.com). Plain
// fetch against its REST API, so there's no extra dependency — it needs
// SANKOFA_API_KEY in the environment.
//
// CONTACT_FROM_EMAIL must be a sender verified with Sankofa; CONTACT_TO_EMAIL
// is where the messages land.

const SANKOFA_ENDPOINT = "https://api.trysankofa.com/v1/emails";
const TO = process.env.CONTACT_TO_EMAIL ?? "daniel.byiringiro.cs@gmail.com";
const FROM = process.env.CONTACT_FROM_EMAIL ?? "wayform@trysankofa.com";

const LIMITS = { name: 100, email: 200, message: 4000 };

/** Sankofa takes HTML, so anything a visitor typed has to be neutralised. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Bots fill every field they find; people never see this one.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return Response.json({ ok: true });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!name || !email || !message) {
    return Response.json(
      { error: "Please fill in your name, email, and message." },
      { status: 400 },
    );
  }
  if (
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    message.length > LIMITS.message
  ) {
    return Response.json({ error: "That message is too long." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { error: "That email address doesn't look right." },
      { status: 400 },
    );
  }

  const apiKey = process.env.SANKOFA_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Messaging isn't configured yet. Please try again later." },
      { status: 503 },
    );
  }

  const html = [
    `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
    "<hr>",
    `<p>From: ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>`,
  ].join("");

  let res: Response;
  try {
    res = await fetch(SANKOFA_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: TO,
        replyTo: email,
        subject: `Wayform contact from ${name}`,
        html,
      }),
    });
  } catch {
    return Response.json(
      { error: "Could not reach the mail service. Please try again." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    console.error("Sankofa error", res.status, await res.text());
    return Response.json(
      { error: "Could not send your message. Please try again." },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
