"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { previewInvite, acceptInvite, type InvitePreview } from "@/utils/pairs";
import { getPlanDay, planLabel } from "@/constants/plan";
import { PassageText } from "@/components/ScriptureText";
import LessonBlock, {
  AdditionalReading,
  type AbsgData,
} from "@/components/LessonBlock";

/** Survives the OAuth round trip so we can come back to this invite. */
export const PENDING_INVITE_KEY = "wayform:pendingInvite";

type Status = "loading" | "ready" | "missing";

export default function JoinClient({ code }: { code: string }) {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [absg, setAbsg] = useState<AbsgData | null>(null);
  const [passage, setPassage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [{ data }, preview] = await Promise.all([
        supabase.auth.getSession(),
        previewInvite(code).catch(() => null),
      ]);
      if (!active) return;

      setSignedIn(!!data.session);
      if (!preview) {
        setStatus("missing");
        return;
      }
      setInvite(preview);
      setStatus("ready");

      // Pull in whatever the pair is actually studying today.
      if (preview.plan_type === "absg") {
        const res = await fetch("/api/absg").then((r) => r.json()).catch(() => null);
        if (active && res && !res.error) setAbsg(res as AbsgData);
      } else if (preview.plan_type) {
        const day = getPlanDay(
          preview.plan_type,
          preview.plan_config,
          preview.current_index,
        );
        if (day) {
          const res = await fetch(
            `/api/passage?q=${encodeURIComponent(day.reference)}`,
          )
            .then((r) => r.json())
            .catch(() => null);
          if (active && res?.text) setPassage(res.text as string);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [code]);

  const signInToJoin = async (provider: "google" | "github") => {
    try {
      localStorage.setItem(PENDING_INVITE_KEY, code);
    } catch {
      /* private mode — they'll land on /loop and can paste the code instead */
    }
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const join = async () => {
    setError(null);
    setJoining(true);
    try {
      await acceptInvite(code);
      try {
        localStorage.removeItem(PENDING_INVITE_KEY);
      } catch {
        /* ignore */
      }
      router.replace("/loop");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join this study.");
      setJoining(false);
    }
  };

  if (status === "loading") {
    return (
      <Shell>
        <p className="text-center font-serif text-stone-500">
          Loading this invitation…
        </p>
      </Shell>
    );
  }

  if (status === "missing" || !invite) {
    return (
      <Shell>
        <div className="rounded-2xl border border-stone-200/70 bg-white/70 p-8 text-center">
          <p className="font-serif text-xl text-stone-800">
            This invite isn&rsquo;t available
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            The code may have been used already, or the study may have ended.
            Ask whoever invited you for a fresh link.
          </p>
        </div>
      </Shell>
    );
  }

  const inviter = invite.inviter_name || "Someone";
  const day =
    invite.plan_type && invite.plan_type !== "absg"
      ? getPlanDay(invite.plan_type, invite.plan_config, invite.current_index)
      : null;

  return (
    <Shell>
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-green-700/80">
          An invitation
        </p>
        <h1 className="mt-4 font-serif text-3xl leading-tight text-stone-800">
          {inviter} wants to study the Bible with you
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-stone-600">
          {invite.plan_type
            ? `They're working through ${planLabel(invite.plan_type)}. Here's today's study — have a read before you decide.`
            : "They haven't picked a plan yet. Join and you can choose it together."}
        </p>
      </header>

      {/* Today's study, exactly as they'd see it */}
      {invite.plan_type === "absg" && absg && (
        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
            {absg.dayTitle || absg.weekTitle}
          </p>
          <div className="mt-5 space-y-5">
            {absg.blocks.map((block, i) => (
              <LessonBlock key={i} block={block} />
            ))}
          </div>
          {absg.additional.length > 0 && (
            <AdditionalReading
              title={absg.additionalTitle ?? "Additional Reading"}
              blocks={absg.additional}
            />
          )}
        </section>
      )}

      {invite.plan_type && invite.plan_type !== "absg" && day && (
        <section className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
            Day {invite.current_index} · {day.reference}
          </p>
          {passage ? (
            <blockquote className="mt-5 font-serif text-lg leading-loose text-stone-800">
              <PassageText text={passage} />
            </blockquote>
          ) : (
            <p className="mt-5 text-sm text-stone-400">Loading passage…</p>
          )}
        </section>
      )}

      {/* The ask */}
      <section className="mt-12 rounded-2xl border border-green-700/20 bg-green-50/50 p-6">
        <p className="font-serif text-lg text-stone-800">
          Study this with {inviter}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          You&rsquo;ll each read it daily and answer the same few questions.
          Your answers stay between the two of you.
        </p>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {signedIn ? (
          <button
            onClick={join}
            disabled={joining}
            className="mt-5 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {joining ? "Joining…" : `Join ${inviter}`}
          </button>
        ) : (
          <div className="mt-5 space-y-3">
            <button
              onClick={() => signInToJoin("google")}
              className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              Continue with Google to join
            </button>
            <button
              onClick={() => signInToJoin("github")}
              className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
            >
              Continue with GitHub to join
            </button>
            <p className="text-center text-xs text-stone-500">
              Signing in creates your account. You&rsquo;ll come straight back
              here.
            </p>
          </div>
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-24">{children}</div>
    </main>
  );
}
