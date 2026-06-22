"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, BookOpen, Sparkles, Hand } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { getOrCreateProgress, advanceDay } from "@/utils/progress";
import { getDailyLoop, TRACK_TITLE, TRACK_LENGTH } from "@/constants/track";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Status = "loading" | "ready" | "error";

export default function DailyLoopPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState(1); // furthest unlocked day
  const [viewDay, setViewDay] = useState(1); // day currently being viewed
  const [advancing, setAdvancing] = useState(false);

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

  const handleAdvance = async () => {
    if (!userId) return;
    setAdvancing(true);
    try {
      const progress = await advanceDay(userId, currentDay);
      setCurrentDay(progress.current_day);
      setViewDay(progress.current_day);
    } catch {
      setErrorMsg("Could not save your progress. Please try again.");
    } finally {
      setAdvancing(false);
    }
  };

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-r from-rose-100 to-teal-100">
        <p className="text-slate-600">Loading your daily loop…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-r from-rose-100 to-teal-100 px-6">
        <p className="max-w-md text-center text-slate-700">{errorMsg}</p>
      </main>
    );
  }

  const loop = getDailyLoop(viewDay);
  if (!loop) return null;

  const isOnCurrent = viewDay === currentDay;
  const canAdvance = isOnCurrent && currentDay < TRACK_LENGTH;
  const finishedTrack = currentDay >= TRACK_LENGTH && isOnCurrent;

  return (
    <main className="min-h-screen bg-gradient-to-r from-rose-100 to-teal-100">
      <div className="mx-auto max-w-2xl px-6 pb-20 pt-24">
        {/* Track + day header */}
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-green-600">
            {TRACK_TITLE}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-800">
            Day {loop.day} of {TRACK_LENGTH}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Theme: {loop.theme}</p>
        </div>

        {/* Day progress strip */}
        <div className="mt-6 flex flex-wrap justify-center gap-1.5">
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
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  active
                    ? "bg-green-600 text-white"
                    : unlocked
                      ? "bg-white text-slate-700 hover:bg-green-50"
                      : "cursor-not-allowed bg-white/50 text-slate-300",
                ].join(" ")}
              >
                {unlocked ? d : <Lock className="h-3 w-3" />}
              </button>
            );
          })}
        </div>

        {/* Scripture Anchor */}
        <section className="mt-8 rounded-2xl bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 text-green-600">
            <BookOpen className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Scripture Anchor</h2>
          </div>
          <p className="mt-3 text-sm font-medium text-slate-500">
            {loop.scripture.reference}
          </p>

          <audio
            controls
            preload="none"
            src={loop.scripture.audioUrl}
            className="mt-3 w-full"
          >
            Your browser does not support audio playback.
          </audio>

          <p className="mt-4 leading-relaxed text-slate-700">
            {loop.scripture.text}
          </p>
          <p className="mt-3 text-xs text-slate-400">
            Text: {loop.scripture.translation}. Audio: ESV “Hear the Word”
            (© Crossway).
          </p>
        </section>

        {/* Identity Reframe */}
        <section className="mt-5 rounded-2xl bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 text-green-600">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Identity Reframe</h2>
          </div>
          <p className="mt-3 text-xl font-medium leading-snug text-slate-800">
            {loop.identityReframe}
          </p>
        </section>

        {/* Micro-Practice */}
        <section className="mt-5 rounded-2xl bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 text-green-600">
            <Hand className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Micro-Practice</h2>
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            Complete within 24 hours
          </p>
          <p className="mt-3 leading-relaxed text-slate-700">
            {loop.microPractice}
          </p>
        </section>

        <Separator className="my-8" />

        {/* Navigation + advancement */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={viewDay <= 1}
            onClick={() => setViewDay((d) => Math.max(1, d - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          {canAdvance ? (
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={advancing}
              onClick={handleAdvance}
            >
              {advancing ? "Saving…" : `Continue to Day ${currentDay + 1}`}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : finishedTrack ? (
            <span className="text-sm font-medium text-green-700">
              Track complete 🎉
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={viewDay >= currentDay}
              onClick={() =>
                setViewDay((d) => Math.min(currentDay, d + 1))
              }
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
