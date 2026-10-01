"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
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

interface Block {
  kind: "text" | "question" | "heading" | "quote";
  text: string;
}

interface AbsgData {
  quarterTitle: string;
  coverUrl: string;
  weekTitle: string;
  dayTitle: string;
  weekNumber: number;
  dayOfWeek: number;
  date: string; // YYYY-MM-DD
  blocks: Block[];
  additionalTitle: string | null;
  additional: Block[];
}

/**
 * The ESV API marks verses inline as "[3]". Render those as small raised
 * numbers so the passage still reads as prose.
 */
function PassageText({ text }: { text: string }) {
  const parts = text.split(/\[(\d+)\]/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <sup
            key={i}
            className="mr-0.5 align-super text-[0.65em] font-medium text-green-700/70"
          >
            {part}
          </sup>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** One lesson block, styled by kind the way the printed guide sets them. */
function LessonBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "question":
      return (
        <div className="rounded-2xl border border-green-700/20 bg-green-50/50 p-5">
          <p className="font-medium leading-relaxed text-stone-800">
            {block.text}
          </p>
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-green-700/30 pl-5 font-serif text-lg italic leading-loose text-stone-700">
          {block.text}
        </blockquote>
      );
    case "heading":
      return (
        <p className="font-serif text-xl text-stone-800">{block.text}</p>
      );
    default:
      return (
        <p className="whitespace-pre-line font-serif text-lg leading-loose text-stone-800">
          {block.text}
        </p>
      );
  }
}

/** Supplementary material, tucked behind a disclosure like the printed guide. */
function AdditionalReading({
  title,
  blocks,
}: {
  title: string;
  blocks: Block[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 rounded-2xl border border-stone-200/70 bg-white/50">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-stone-700">{title}</span>
        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-stone-400 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {open && (
        <div className="space-y-5 border-t border-stone-200/70 px-5 pb-6 pt-5">
          {blocks.map((block, i) => (
            <LessonBlock key={i} block={block} />
          ))}
        </div>
      )}
    </div>
  );
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
  // The guide calls Saturday "Sabbath", so lead with its own day names
  // rather than the locale's weekday.
  const dayName = DAY_NAMES[absg.dayOfWeek - 1] ?? "Today";
  const dateLabel = `${dayName} · ${new Date(`${absg.date}T00:00:00Z`).toLocaleDateString(
    undefined,
    { month: "long", day: "numeric", timeZone: "UTC" },
  )}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-20">
        <ChurchNudge />

        <header className="relative overflow-hidden rounded-2xl bg-stone-900">
          {absg.coverUrl && (
            // The quarterly cover is a book mockup with a grey spine down its
            // right edge, so overshoot the width and anchor left to clip it.
            <Image
              src={absg.coverUrl}
              alt=""
              width={854}
              height={1280}
              className="absolute inset-0 h-full w-[119%] max-w-none object-cover object-left opacity-70"
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-stone-950/20" />
          <div className="relative flex min-h-[220px] flex-col justify-end p-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
              {dateLabel}
            </p>
            <h1 className="mt-2 font-serif text-3xl leading-tight text-white">
              {absg.dayTitle || absg.weekTitle}
            </h1>
            <p className="mt-2 text-xs text-white/60">
              Week {absg.weekNumber} · {absg.weekTitle} · {absg.quarterTitle}
            </p>
          </div>
        </header>

        <section className="mt-14">
          <SectionLabel>This Week&rsquo;s Study</SectionLabel>
          <div className="mt-6 space-y-5">
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

          <p className="mt-6 text-xs leading-relaxed text-stone-400">
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
              <PassageText text={esvText} />
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
