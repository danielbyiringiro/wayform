"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
  getMyPair,
  advancePairDay,
  isNextDayUnlocked,
  type Pair,
} from "@/utils/pairs";
import { getPairReflections, type Reflection } from "@/utils/reflection";
import { getPlanDay, planTotalDays, planLabel } from "@/constants/plan";
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
  const [pair, setPair] = useState<Pair | null>(null);
  const [viewDay, setViewDay] = useState(1); // day currently being viewed
  const [advancing, setAdvancing] = useState(false);
  const [esvText, setEsvText] = useState<string | null>(null);
  const [esvFailed, setEsvFailed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [dayReflections, setDayReflections] = useState<Reflection[]>([]);
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
        const p = await getMyPair(session.user.id);
        if (!active) return;
        if (!p || p.status !== "active" || !p.plan_type) {
          router.replace("/pair");
          return;
        }
        setUserId(session.user.id);
        setPair(p);
        setViewDay(p.current_index);
        setStatus("ready");
      } catch {
        if (!active) return;
        setErrorMsg(
          "Could not load your pair's progress. Make sure migration 0011_pairs_and_study_plans.sql has been run in Supabase.",
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

  const planType = pair?.plan_type ?? null;
  const planConfig = pair?.plan_config ?? {};
  const totalDays = planType ? planTotalDays(planType, planConfig) : 0;
  const planDay = planType ? getPlanDay(planType, planConfig, viewDay) : null;

  // Fetch live ESV text for the day being viewed. ABSG ships an embedded
  // fallback; Chapter-a-Day / Custom Range have no embedded text at all.
  useEffect(() => {
    if (status !== "ready" || !planDay) return;

    let active = true;
    setEsvText(null);
    setEsvFailed(false);
    fetch(`/api/passage?q=${encodeURIComponent(planDay.reference)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.text) setEsvText(data.text as string);
        else setEsvFailed(true);
      })
      .catch(() => {
        if (active) setEsvFailed(true);
      });

    return () => {
      active = false;
    };
    // planDay is a fresh object every render; re-run only when the actual
    // reference (or readiness) changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planDay?.reference, status]);

  // Load both partners' reflections for the day being viewed.
  useEffect(() => {
    if (status !== "ready" || !pair) return;
    let active = true;
    setDayReflections([]);
    setReflectionLoading(true);
    getPairReflections(pair.id, viewDay)
      .then((rows) => {
        if (active) setDayReflections(rows);
      })
      .catch(() => {
        /* treat as no reflections yet */
      })
      .finally(() => {
        if (active) setReflectionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [viewDay, status, pair]);

  const handleAdvance = async () => {
    if (!pair) return;
    setAdvancing(true);
    try {
      const updated = await advancePairDay(pair.id, pair.current_index, totalDays);
      setPair(updated);
      setViewDay(updated.current_index);
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

  if (!pair || !planType || !planDay) return null;

  const mine = dayReflections.find((r) => r.user_id === userId) ?? null;
  const partner = dayReflections.find((r) => r.user_id !== userId) ?? null;

  const isOnCurrent = viewDay === pair.current_index;
  const hasNextDay = pair.current_index < totalDays;
  const nextDayUnlocked = isNextDayUnlocked(pair.current_index_started_at);
  const bothReflected = !!mine && !!partner;
  const needsReflection = isOnCurrent && !reflectionLoading && !mine;
  const awaitingPartner = isOnCurrent && !!mine && !partner;
  const canAdvance =
    isOnCurrent && hasNextDay && nextDayUnlocked && bothReflected;
  const awaitingNextDay =
    isOnCurrent && hasNextDay && !nextDayUnlocked && bothReflected;
  const finishedPlan =
    pair.current_index >= totalDays && isOnCurrent && bothReflected;

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-20">
        <ChurchNudge />

        {/* Quiet header */}
        <header className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-green-700/80">
            {planLabel(planType)}
          </p>
          <h1 className="mt-3 font-serif text-3xl text-stone-800">
            Day {planDay.dayIndex}
          </h1>
          <div className="mx-auto mt-5 max-w-[220px]">
            <div className="h-1 rounded-full bg-stone-200">
              <div
                className="h-1 rounded-full bg-green-600 transition-all"
                style={{ width: `${(planDay.dayIndex / totalDays) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-stone-400">
              Day {planDay.dayIndex} of {totalDays} · {planDay.title}
            </p>
          </div>
        </header>

        {/* Scripture Anchor */}
        <section className="mt-14">
          <SectionLabel>Scripture</SectionLabel>
          <p className="mt-4 text-sm font-medium text-stone-500">
            {planDay.reference}
          </p>
          {esvText || planDay.fallbackText ? (
            <blockquote className="mt-4 font-serif text-lg leading-loose text-stone-800">
              {esvText ?? planDay.fallbackText}
            </blockquote>
          ) : esvFailed ? (
            <p className="mt-4 text-sm leading-relaxed text-stone-500">
              Scripture text isn’t available here yet — open {planDay.reference}{" "}
              in your own Bible for today. (Set ESV_API_KEY in .env.local to
              enable live text.)
            </p>
          ) : (
            <p className="mt-4 text-sm text-stone-400">Loading passage…</p>
          )}

          {planDay.audioUrl && (
            <div className="mt-6">
              <p className="mb-2 text-xs uppercase tracking-wider text-stone-400">
                Listen
              </p>
              <audio
                controls
                preload="none"
                src={planDay.audioUrl}
                className="w-full"
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-stone-400">
            {esvText
              ? "Scripture text and audio are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway. Used by permission. All rights reserved."
              : `Text: ${planDay.translation}.`}
          </p>
        </section>

        {/* Identity Reframe — only on plans that carry one (ABSG) */}
        {planDay.identityReframe && (
          <section className="mt-14">
            <SectionLabel>Identity Reframe</SectionLabel>
            <p className="mt-6 text-center font-serif text-2xl italic leading-relaxed text-stone-800">
              {planDay.identityReframe}
            </p>
          </section>
        )}

        {/* Micro-Practice */}
        <section className="mt-14">
          <SectionLabel>Today’s Practice</SectionLabel>
          <p className="mt-2 text-xs uppercase tracking-wider text-stone-400">
            Within 24 hours, together
          </p>
          <p className="mt-4 text-lg leading-relaxed text-stone-700">
            {planDay.microPractice}
          </p>
        </section>

        {/* Reflection — each partner submits their own */}
        <section className="mt-14 space-y-6">
          <SectionLabel>Reflection</SectionLabel>
          {reflectionLoading ? (
            <p className="mt-4 text-sm text-stone-400">
              Loading reflections…
            </p>
          ) : (
            <>
              {mine && <ReflectionSummary reflection={mine} label="You" />}
              {partner && (
                <ReflectionSummary reflection={partner} label="Your partner" />
              )}
              {!mine && isOnCurrent && userId && (
                <div>
                  <p className="mb-5 text-sm text-stone-500">
                    Take two quiet minutes. There are no wrong answers.
                  </p>
                  <ReflectionForm
                    userId={userId}
                    pairId={pair.id}
                    dayIndex={viewDay}
                    onSubmitted={(r) =>
                      setDayReflections((prev) => [
                        ...prev.filter((x) => x.user_id !== r.user_id),
                        r,
                      ])
                    }
                  />
                </div>
              )}
              {!mine && !isOnCurrent && (
                <p className="mt-4 text-sm text-stone-400">
                  No reflection was recorded for this day.
                </p>
              )}
            </>
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
                {advancing ? "Saving…" : `Continue to Day ${pair.current_index + 1}`}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : awaitingPartner ? (
              <p className="text-center text-sm text-stone-500">
                Your reflection is saved — waiting on your partner’s.
              </p>
            ) : awaitingNextDay ? (
              <div className="flex flex-col items-center gap-1 text-center">
                <Lock className="h-4 w-4 text-stone-400" />
                <p className="text-sm text-stone-600">
                  You’ve both completed today’s loop.
                </p>
                <p className="text-xs text-stone-400">
                  Day {pair.current_index + 1} opens tomorrow — rest in this one.
                </p>
              </div>
            ) : finishedPlan ? (
              <p className="text-center font-serif text-lg text-green-700">
                You’ve completed this plan together. Well done.
              </p>
            ) : needsReflection ? (
              <p className="text-center text-sm text-stone-500">
                Complete today’s reflection above to finish the day.
              </p>
            ) : null
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewDay(pair.current_index)}
            >
              Return to Day {pair.current_index}
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
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
                const unlocked = d <= pair.current_index;
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
