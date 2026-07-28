"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { getOrCreateProgress, advanceDay, isNextDayUnlocked } from "@/utils/progress";
import { getReflection, type Reflection } from "@/utils/reflection";
import { getDailyLoop, TRACK_TITLE, TRACK_LENGTH } from "@/constants/track";
import { Button } from "@/components/ui/button";
import ReflectionForm from "@/components/ReflectionForm";
import ReflectionSummary from "@/components/ReflectionSummary";
import ChurchNudge from "@/components/ChurchNudge";

type Status = "loading" | "ready" | "error";

export default function DailyLoopPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState(1); // furthest unlocked day
  const [currentDayStartedAt, setCurrentDayStartedAt] = useState<string>(
    new Date().toISOString(),
  );
  const [viewDay, setViewDay] = useState(1); // day currently being viewed
  const [advancing, setAdvancing] = useState(false);
  // ESV passage text fetched per day (matches the ESV audio). Falls back to
  // the embedded KJV text if the ESV key is not configured.
  const [esvText, setEsvText] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // The reflection for the day being viewed (null if not submitted yet).
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/signin");
        return;
      }

      try {
        const progress = await getOrCreateProgress(session.user.id);
        if (!active) return;
        setUserId(session.user.id);
        setCurrentDay(progress.current_day);
        setCurrentDayStartedAt(progress.current_day_started_at);
        setViewDay(progress.current_day);
        setStatus("ready");
      } catch {
        if (!active) return;
        setErrorMsg(
          "Could not load your progress. Make sure the user_progress table has been created in Supabase (see supabase/migrations/0001_user_progress.sql).",
        );
        setStatus("error");
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) router.replace("/signin");
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  // Fetch the ESV text for the day being viewed (matches the ESV audio).
  useEffect(() => {
    if (status !== "ready") return;
    const loop = getDailyLoop(viewDay);
    if (!loop) return;

    let active = true;
    setEsvText(null);
    fetch(`/api/passage?q=${encodeURIComponent(loop.scripture.reference)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.text) setEsvText(data.text as string);
      })
      .catch(() => {
        /* fall back to embedded KJV text */
      });

    return () => {
      active = false;
    };
  }, [viewDay, status]);

  // Load the reflection for the day being viewed.
  useEffect(() => {
    if (status !== "ready" || !userId) return;
    let active = true;
    setReflection(null);
    setReflectionLoading(true);
    getReflection(userId, viewDay)
      .then((r) => {
        if (active) setReflection(r);
      })
      .catch(() => {
        /* treat as no reflection yet */
      })
      .finally(() => {
        if (active) setReflectionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [viewDay, status, userId]);

  const handleAdvance = async () => {
    if (!userId) return;
    setAdvancing(true);
    try {
      const progress = await advanceDay(userId, currentDay);
      setCurrentDay(progress.current_day);
      setCurrentDayStartedAt(progress.current_day_started_at);
      setViewDay(progress.current_day);
    } catch {
      setErrorMsg("Could not save your progress. Please try again.");
    } finally {
      setAdvancing(false);
    }
  };

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="font-serif text-stone-500">Preparing today’s loop…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="max-w-md text-center leading-relaxed text-stone-600">
          {errorMsg}
        </p>
      </main>
    );
  }

  const loop = getDailyLoop(viewDay);
  if (!loop) return null;

  const isOnCurrent = viewDay === currentDay;
  const hasNextDay = currentDay < TRACK_LENGTH;
  const nextDayUnlocked = isNextDayUnlocked(currentDayStartedAt);
  const reflected = !!reflection;
  // The day is "complete" once a reflection is submitted; advancing also
  // waits for the calendar to roll over to the next day.
  const needsReflection = isOnCurrent && !reflectionLoading && !reflected;
  const canAdvance = isOnCurrent && hasNextDay && nextDayUnlocked && reflected;
  const awaitingNextDay =
    isOnCurrent && hasNextDay && !nextDayUnlocked && reflected;
  const finishedTrack = currentDay >= TRACK_LENGTH && isOnCurrent && reflected;

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-20">
        <ChurchNudge />

        {/* Quiet header */}
        <header className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-green-700/80">
            {TRACK_TITLE}
          </p>
          <h1 className="mt-3 font-serif text-3xl text-stone-800">
            Day {loop.day}
          </h1>
          <div className="mx-auto mt-5 max-w-[220px]">
            <div className="h-1 rounded-full bg-stone-200">
              <div
                className="h-1 rounded-full bg-green-600 transition-all"
                style={{ width: `${(loop.day / TRACK_LENGTH) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-stone-400">
              Day {loop.day} of {TRACK_LENGTH} · {loop.theme}
            </p>
          </div>
        </header>

        {/* Scripture Anchor */}
        <section className="mt-14">
          <SectionLabel>Scripture</SectionLabel>
          <p className="mt-4 text-sm font-medium text-stone-500">
            {loop.scripture.reference}
          </p>
          <blockquote className="mt-4 font-serif text-lg leading-loose text-stone-800">
            {esvText ?? loop.scripture.text}
          </blockquote>

          <div className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-wider text-stone-400">
              Listen
            </p>
            <audio
              controls
              preload="none"
              src={loop.scripture.audioUrl}
              className="w-full"
            >
              Your browser does not support audio playback.
            </audio>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-stone-400">
            {esvText
              ? "Scripture text and audio are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway. Used by permission. All rights reserved."
              : `Text: ${loop.scripture.translation}. Audio: ESV “Hear the Word” (© Crossway).`}
          </p>
        </section>

        {/* Identity Reframe — the still point */}
        <section className="mt-14">
          <SectionLabel>Identity Reframe</SectionLabel>
          <p className="mt-6 text-center font-serif text-2xl italic leading-relaxed text-stone-800">
            {loop.identityReframe}
          </p>
        </section>

        {/* Micro-Practice */}
        <section className="mt-14">
          <SectionLabel>Today’s Practice</SectionLabel>
          <p className="mt-2 text-xs uppercase tracking-wider text-stone-400">
            Within 24 hours
          </p>
          <p className="mt-4 text-lg leading-relaxed text-stone-700">
            {loop.microPractice}
          </p>
        </section>

        {/* Reflection */}
        <section className="mt-14">
          <SectionLabel>Reflection</SectionLabel>
          {reflectionLoading ? (
            <p className="mt-4 text-sm text-stone-400">
              Loading your reflection…
            </p>
          ) : reflection ? (
            <div className="mt-4">
              <ReflectionSummary reflection={reflection} />
            </div>
          ) : isOnCurrent && userId ? (
            <div className="mt-4">
              <p className="mb-5 text-sm text-stone-500">
                Take two quiet minutes. There are no wrong answers.
              </p>
              <ReflectionForm
                userId={userId}
                day={viewDay}
                onSubmitted={(r) => setReflection(r)}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-stone-400">
              No reflection was recorded for this day.
            </p>
          )}
        </section>

        {/* Footer actions */}
        <div className="mt-16 flex flex-col items-center gap-5">
          {isOnCurrent ? (
            canAdvance ? (
              <Button
                className="bg-green-600 px-6 hover:bg-green-700"
                disabled={advancing}
                onClick={handleAdvance}
              >
                {advancing ? "Saving…" : `Continue to Day ${currentDay + 1}`}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : awaitingNextDay ? (
              <div className="flex flex-col items-center gap-1 text-center">
                <Lock className="h-4 w-4 text-stone-400" />
                <p className="text-sm text-stone-600">
                  You’ve completed today’s loop.
                </p>
                <p className="text-xs text-stone-400">
                  Day {currentDay + 1} opens tomorrow — rest in this one.
                </p>
              </div>
            ) : finishedTrack ? (
              <p className="text-center font-serif text-lg text-green-700">
                You’ve completed the track. Well done.
              </p>
            ) : needsReflection ? (
              <p className="text-center text-sm text-stone-500">
                Complete today’s reflection above to finish the day.
              </p>
            ) : null
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setViewDay(currentDay)}>
              Return to Day {currentDay}
            </Button>
          )}

          {/* Quiet review of earlier days */}
          <button
            onClick={() => setReviewOpen((v) => !v)}
            className="text-xs text-stone-400 underline-offset-4 hover:text-stone-600 hover:underline"
          >
            {reviewOpen ? "Hide earlier days" : "Review earlier days"}
          </button>
          {reviewOpen && (
            <div className="flex max-w-xs flex-wrap justify-center gap-1.5">
              {Array.from({ length: TRACK_LENGTH }, (_, i) => i + 1).map((d) => {
                const unlocked = d <= currentDay;
                const active = d === viewDay;
                return (
                  <button
                    key={d}
                    disabled={!unlocked}
                    onClick={() => unlocked && setViewDay(d)}
                    aria-label={`Day ${d}${unlocked ? "" : " (locked)"}`}
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors",
                      active
                        ? "bg-green-600 text-white"
                        : unlocked
                          ? "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-green-50"
                          : "cursor-not-allowed text-stone-300",
                    ].join(" ")}
                  >
                    {unlocked ? d : <Lock className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
        {children}
      </span>
      <span className="h-px flex-1 bg-stone-200" />
    </div>
  );
}
