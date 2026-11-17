import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/utils/email";

// Nudges both partners ahead of their next session.
//
// The job is idempotent per occurrence: the pair records which session it was
// last reminded about, so running this hourly or once a day both send exactly
// one email per session. That matters because Vercel's Hobby plan only allows
// a daily cron — correctness shouldn't depend on how often it fires.
//
// Needs CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY. The job reads across every
// pair, which RLS rightly forbids for the anon key.

interface Recipient {
  email: string | null;
  name: string | null;
  timezone: string | null;
}

interface DueRow {
  pair_id: string;
  occurrence: string;
  session_zone: string;
  plan_type: string;
  recipients: Recipient[];
}

function formatIn(when: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  }).format(when);
}

function body(recipient: Recipient, when: Date, sessionZone: string): string {
  // Partners are often in different places, so lead with their own local
  // time and only mention the pair's zone when it differs.
  const zone = recipient.timezone ?? sessionZone;
  const theirTime = formatIn(when, zone);
  const pairTime = formatIn(when, sessionZone);
  const greeting = recipient.name ? `Hi ${recipient.name.split(" ")[0]},` : "Hi,";

  return [
    `<p>${greeting}</p>`,
    `<p>Your next Wayform session is <strong>${theirTime}</strong>.</p>`,
    zone !== sessionZone
      ? `<p style="color:#57534e">That's ${pairTime} where the session is set (${sessionZone}).</p>`
      : "",
    `<p>Give your partner a call and open Wayform together — it'll walk you both through the reading, the questions and a shared note.</p>`,
    `<p><a href="https://wayform-mu.vercel.app/session">Open today's session</a></p>`,
  ].join("");
}

export async function POST(request: NextRequest) {
  return handle(request);
}

// Vercel Cron issues a GET.
export async function GET(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not authorised." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json(
      { error: "Supabase service credentials are not configured." },
      { status: 503 },
    );
  }

  const admin = createClient(url, serviceKey, {
    db: { schema: "wayform" },
    auth: { persistSession: false },
  });

  const { data, error } = await admin.rpc("sessions_due_reminder");
  if (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }

  const due = (data as DueRow[] | null) ?? [];
  let sent = 0;
  let failed = 0;

  for (const row of due) {
    const when = new Date(row.occurrence);
    let anySent = false;

    for (const recipient of row.recipients ?? []) {
      if (!recipient.email) continue;
      try {
        await sendEmail({
          to: recipient.email,
          subject: `Your Wayform session is ${formatIn(
            when,
            recipient.timezone ?? row.session_zone,
          )}`,
          html: body(recipient, when, row.session_zone),
        });
        sent++;
        anySent = true;
      } catch (e) {
        failed++;
        console.error("reminder failed", recipient.email, e);
      }
    }

    // Marked on any success: a permanently bad address shouldn't make the
    // working one get reminded again on every run.
    if (anySent) {
      await admin
        .from("pairs")
        .update({ reminder_sent_for: row.occurrence })
        .eq("id", row.pair_id);
    }
  }

  return Response.json({ pairs: due.length, sent, failed });
}
