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

  if (!pair || !userId || !pair.plan_type) return null;

  return pair.plan_type === "absg" ? (
    <AbsgLoop pair={pair} userId={userId} />
  ) : (
    <PacedLoop pair={pair} userId={userId} planType={pair.plan_type} />
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

// ---------------------------------------------------------------------------
// ABSG: calendar-driven, open-ended. Everyone following it on the same
// calendar day sees the same real-world lesson section — there's no pair-paced
// "Day N of M" progression or advance button, since tomorrow's date is what
// unlocks tomorrow's section.
// ---------------------------------------------------------------------------

interface AbsgData {
  quarterTitle: string;
  weekTitle: string;
  dayTitle: string;
  weekNumber: number;
  dayOfWeek: number;
  date: string; // YYYY-MM-DD
  paragraphs: string[];
}

function dateToDayIndex(isoDate: string): number {
  return Math.floor(new Date(`${isoDate}T00:00:00Z`).getTime() / 86_400_000);
}

const DAY_NAMES = ["Sabbath", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function AbsgLoop({ pair, userId }: { pair: Pair; userId: string }) {
  const [absg, setAbsg] = useState<AbsgData | null>(null);
  const [absgError, setAbsgError] = useState<string | null>(null);
  const [dayReflections, setDayReflections] = useState<Reflection[]>([]);
  const [reflectionLoading, setReflectionLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/absg")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.error) setAbsgError(data.error as string);
        else setAbsg(data as AbsgData);
      })
      .catch(() => {
        if (active) setAbsgError("Could not load this week's ABSG section.");
      });
    return () => {
      active = false;
    };
  }, []);

  const dayIndex = absg ? dateToDayIndex(absg.date) : null;

  useEffect(() => {
    if (dayIndex === null) return;
    let active = true;
    getPairReflections(pair.id, dayIndex)
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
  }, [dayIndex, pair.id]);

  if (absgError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="max-w-md text-center text-sm leading-relaxed text-stone-600">
          {absgError}
        </p>
      </main>
    );
  }

  if (!absg || dayIndex === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="font-serif text-stone-500">Loading this week’s ABSG section…</p>
      </main>
    );
  }

  const mine = dayReflections.find((r) => r.user_id === userId) ?? null;
  const partner = dayReflections.find((r) => r.user_id !== userId) ?? null;
  const dateLabel = new Date(`${absg.date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-20">
        <ChurchNudge />

        <header className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-green-700/80">
            {planLabel("absg")}
          </p>
          <h1 className="mt-3 font-serif text-3xl text-stone-800">
            {DAY_NAMES[absg.dayOfWeek - 1] ?? "Today"}
          </h1>
          <p className="mt-2 text-xs text-stone-400">
            {dateLabel} · Week {absg.weekNumber} · {absg.quarterTitle}
          </p>
        </header>

        <section className="mt-14">
          <SectionLabel>{absg.dayTitle || absg.weekTitle}</SectionLabel>
          <div className="mt-4 space-y-4">
            {absg.paragraphs.map((p, i) => (
              <p key={i} className="font-serif text-lg leading-loose text-stone-800">
                {p}
              </p>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-stone-400">
            Sabbath School Adult Bible Study Guide, fetched live for today from
            the official lesson content.
          </p>
        </section>

        <section className="mt-14">
          <SectionLabel>Today’s Practice</SectionLabel>
          <p className="mt-4 text-lg leading-relaxed text-stone-700">
            Together, talk through one thing from today’s section that stood
            out to each of you, and pray about it.
          </p>
        </section>

        <section className="mt-14 space-y-6">
          <SectionLabel>Reflection</SectionLabel>
          {reflectionLoading ? (
            <p className="mt-4 text-sm text-stone-400">Loading reflections…</p>
          ) : (
            <>
              {mine && <ReflectionSummary reflection={mine} label="You" />}
              {partner && (
                <ReflectionSummary reflection={partner} label="Your partner" />
              )}
              {!mine && (
                <div>
                  <p className="mb-5 text-sm text-stone-500">
                    Take two quiet minutes. There are no wrong answers.
                  </p>
                  <ReflectionForm
                    userId={userId}
                    pairId={pair.id}
                    dayIndex={dayIndex}
                    onSubmitted={(r) =>
                      setDayReflections((prev) => [
                        ...prev.filter((x) => x.user_id !== r.user_id),
                        r,
                      ])
                    }
                  />
                </div>
              )}
            </>
          )}
        </section>

        {mine && partner && (
          <p className="mt-16 text-center font-serif text-lg text-green-700">
            You’ve both reflected on today’s study. Come back tomorrow for the
            next section.
          </p>
        )}
        {mine && !partner && (
          <p className="mt-16 text-center text-sm text-stone-500">
            Your reflection is saved — waiting on your partner’s.
          </p>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Chapter a Day / Custom Passage Range: pair-paced, one day unlocked at a
// time, both partners must reflect before advancing.
// ---------------------------------------------------------------------------

function PacedLoop({
  pair: initialPair,
  userId,
  planType,
}: {
  pair: Pair;
  userId: string;
  planType: "chapter_a_day" | "custom_range";
}) {
  const [pair, setPair] = useState(initialPair);
  const [viewDay, setViewDay] = useState(initialPair.current_index);
  const [advancing, setAdvancing] = useState(false);
  const [esvText, setEsvText] = useState<string | null>(null);
  const [esvFailed, setEsvFailed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [dayReflections, setDayReflections] = useState<Reflection[]>([]);
  const [reflectionLoading, setReflectionLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const planConfig = pair.plan_config ?? {};
  const totalDays = planTotalDays(planType, planConfig);
  const planDay = getPlanDay(planType, planConfig, viewDay);

  useEffect(() => {
    if (!planDay) return;

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
    // reference changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planDay?.reference]);

  useEffect(() => {
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
  }, [viewDay, pair.id]);

  const handleAdvance = async () => {
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

  if (!planDay) return null;

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

        {errorMsg && (
          <p className="mb-6 rounded-lg bg-red-50 px-4 py-2.5 text-center text-sm text-red-700">
            {errorMsg}
          </p>
        )}

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

        <section className="mt-14">
          <SectionLabel>Scripture</SectionLabel>
          <p className="mt-4 text-sm font-medium text-stone-500">
            {planDay.reference}
          </p>
          {esvText ? (
            <blockquote className="mt-4 font-serif text-lg leading-loose text-stone-800">
              {esvText}
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
          {esvText && (
            <p className="mt-4 text-xs leading-relaxed text-stone-400">
              Scripture text is from the ESV® Bible (The Holy Bible, English
              Standard Version®), © 2001 by Crossway. Used by permission. All
              rights reserved.
            </p>
          )}
        </section>

        <section className="mt-14">
          <SectionLabel>Today’s Practice</SectionLabel>
          <p className="mt-2 text-xs uppercase tracking-wider text-stone-400">
            Within 24 hours, together
          </p>
          <p className="mt-4 text-lg leading-relaxed text-stone-700">
            {planDay.microPractice}
          </p>
        </section>

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
              {!mine && isOnCurrent && (
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
