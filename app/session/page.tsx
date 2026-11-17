"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { getMyPair, advancePairDay, type Pair } from "@/utils/pairs";
import {
  getOrCreateSession,
  saveNote,
  completeSession,
  type PairSession,
} from "@/utils/sessions";
import { getProfileById, firstName, type Profile } from "@/utils/cohort";
import {
  getPlanDay,
  planTotalDays,
  absgDayIndex,
  type PlanDay,
} from "@/constants/plan";
import { PassageText } from "@/components/ScriptureText";
import LessonBlock, { type AbsgData, type Block } from "@/components/LessonBlock";

type Status = "loading" | "ready" | "error";

interface Step {
  label: string;
  heading: string;
  /** Passage prose, when the step is a reading. */
  passage?: string | null;
  /** ABSG blocks, when the step comes from the guide. */
  blocks?: Block[];
  /** A prompt to talk through. */
  prompt?: string;
}

/**
 * The day's material as a sequence of things to do together. The guide is
 * already written as questions, so for ABSG those become the discussion
 * steps; the other plans borrow the reflection prompts for the same job.
 */
function buildSteps(
  planDay: PlanDay | null,
  passage: string | null,
  absg: AbsgData | null,
): Step[] {
  if (absg) {
    const questions = absg.blocks.filter((b) => b.kind === "question");
    const reading = absg.blocks.filter((b) => b.kind !== "question");
    return [
      { label: "Read", heading: absg.dayTitle || absg.weekTitle, blocks: reading },
      ...questions.map((q, i) => ({
        label: `Question ${i + 1}`,
        heading: "Talk about it",
        prompt: q.text,
      })),
      { label: "Pray", heading: "Pray together", prompt: PRAY },
    ];
  }

  if (!planDay) return [];
  return [
    { label: "Read", heading: planDay.reference, passage },
    { label: "Notice", heading: "Talk about it", prompt: "What stood out to each of you?" },
    {
      label: "Change",
      heading: "Talk about it",
      prompt: "What is this passage challenging you to change?",
    },
    { label: "Practice", heading: "This week", prompt: planDay.microPractice },
    { label: "Pray", heading: "Pray together", prompt: PRAY },
  ];
}

const PRAY =
  "Pray for each other out loud, about what you've just read and what you each said.";

export default function SessionPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [pair, setPair] = useState<Pair | null>(null);
  const [session, setSession] = useState<PairSession | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [absg, setAbsg] = useState<AbsgData | null>(null);
  const [planDay, setPlanDay] = useState<PlanDay | null>(null);
  const [passage, setPassage] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let active = true;

    const init = async () => {
      const {
        data: { session: auth },
      } = await supabase.auth.getSession();
      if (!auth) {
        router.replace("/signin");
        return;
      }

      try {
        const p = await getMyPair(auth.user.id);
        if (!active) return;
        if (!p || !p.plan_type) {
          router.replace("/pair");
          return;
        }

        // ABSG is tied to the calendar; the other plans to the pair's own day.
        let dayIndex = p.current_index;
        let absgData: AbsgData | null = null;
        let day: PlanDay | null = null;
        let text: string | null = null;

        if (p.plan_type === "absg") {
          const res = await fetch("/api/absg").then((r) => r.json());
          if (res?.error) throw new Error(res.error);
          absgData = res as AbsgData;
          dayIndex = absgDayIndex(absgData.date);
        } else {
          day = getPlanDay(p.plan_type, p.plan_config, p.current_index);
          if (day) {
            const res = await fetch(
              `/api/passage?q=${encodeURIComponent(day.reference)}`,
            )
              .then((r) => r.json())
              .catch(() => null);
            text = res?.text ?? null;
          }
        }

        const row = await getOrCreateSession(p.id, dayIndex, auth.user.id);
        const otherId = p.user_a === auth.user.id ? p.user_b : p.user_a;
        const other = otherId ? await getProfileById(otherId) : null;

        if (!active) return;
        setUserId(auth.user.id);
        setPair(p);
        setAbsg(absgData);
        setPlanDay(day);
        setPassage(text);
        setSession(row);
        setNote(row.note ?? "");
        setPartner(other);
        setStatus("ready");
      } catch (e) {
        if (!active) return;
        setErrorMsg(
          e instanceof Error ? e.message : "Could not start this session.",
        );
        setStatus("error");
      }
    };

    init();
    return () => {
      active = false;
    };
  }, [router]);

  if (status === "loading") {
    return (
      <Shell>
        <p className="text-center font-serif text-stone-500">
          Opening your session…
        </p>
      </Shell>
    );
  }

  if (status === "error" || !pair || !session || !userId) {
    return (
      <Shell>
        <p className="text-center leading-relaxed text-stone-600">
          {errorMsg ?? "Could not start this session."}
        </p>
      </Shell>
    );
  }

  const steps = buildSteps(planDay, passage, absg);
  const onNote = step >= steps.length;
  const current = steps[step];

  // Only one person needs to write the note; showing it read-only when the
  // other wrote it keeps them from quietly overwriting each other.
  const someoneElseWrote =
    !!session.note && !!session.note_author && session.note_author !== userId;
  const noteLocked = someoneElseWrote && !editingNote;

  const finish = async () => {
    setFinishing(true);
    try {
      if (note.trim()) await saveNote(session.id, note.trim(), userId);
      await completeSession(session.id);

      // A finished session is the day done for both, so move the pair on.
      if (pair.plan_type !== "absg") {
        const total = planTotalDays(pair.plan_type!, pair.plan_config);
        if (pair.current_index < total) {
          await advancePairDay(pair.id, pair.current_index, total);
        }
      }
      router.replace("/loop");
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "Could not finish the session.",
      );
      setFinishing(false);
    }
  };

  return (
    <Shell>
      {/* Who you're with, and how to reach them */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-green-700/80">
          {partner ? `With ${firstName(partner.full_name, partner.email)}` : "On your own"}
        </p>
        {partner?.contact_link && (
          <a
            href={partner.contact_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
          >
            <Phone className="h-3.5 w-3.5" />
            Call {firstName(partner.full_name, partner.email)}
          </a>
        )}
      </div>

      {/* Progress through the steps */}
      <div className="mt-6 flex items-center gap-1.5">
        {steps.map((s, i) => (
          <span
            key={s.label}
            className={[
              "h-1 flex-1 rounded-full transition-colors",
              i < step ? "bg-green-600" : i === step ? "bg-green-600/60" : "bg-stone-200",
            ].join(" ")}
          />
        ))}
        <span
          className={[
            "h-1 flex-1 rounded-full transition-colors",
            onNote ? "bg-green-600/60" : "bg-stone-200",
          ].join(" ")}
        />
      </div>
      <p className="mt-2 text-xs text-stone-400">
        {onNote
          ? `Step ${steps.length + 1} of ${steps.length + 1} · Your note`
          : `Step ${step + 1} of ${steps.length + 1} · ${current?.label}`}
      </p>

      {/* The step */}
      {!onNote && current && (
        <section className="mt-10">
          <h1 className="font-serif text-2xl leading-tight text-stone-800">
            {current.heading}
          </h1>

          {current.blocks && (
            <div className="mt-6 space-y-5">
              {current.blocks.map((b, i) => (
                <LessonBlock key={i} block={b} />
              ))}
            </div>
          )}

          {current.passage !== undefined && (
            <blockquote className="mt-6 font-serif text-lg leading-loose text-stone-800">
              {current.passage ? (
                <PassageText text={current.passage} />
              ) : (
                <span className="text-sm text-stone-500">
                  Open {planDay?.reference} in your own Bible and read it aloud.
                </span>
              )}
            </blockquote>
          )}

          {current.prompt && (
            <p className="mt-6 rounded-2xl border border-green-700/20 bg-green-50/50 p-5 text-lg leading-relaxed text-stone-800">
              {current.prompt}
            </p>
          )}
        </section>
      )}

      {/* The shared note */}
      {onNote && (
        <section className="mt-10">
          <h1 className="font-serif text-2xl text-stone-800">
            What did you land on?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            One of you writes it down. Both of you keep it.
          </p>

          {noteLocked ? (
            <div className="mt-5 rounded-2xl border border-stone-200/70 bg-white/70 p-5">
              <p className="whitespace-pre-line leading-relaxed text-stone-800">
                {session.note}
              </p>
              <button
                onClick={() => setEditingNote(true)}
                className="mt-4 text-sm text-stone-500 underline-offset-4 hover:text-stone-700 hover:underline"
              >
                Edit this note
              </button>
            </div>
          ) : (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={6}
              placeholder="What you talked about, what you each said you'd do…"
              className="mt-5 block w-full resize-none rounded-lg border border-stone-200 bg-white/70 px-3.5 py-2.5 leading-relaxed text-stone-800 placeholder:text-stone-400 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            />
          )}

          {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}
        </section>
      )}

      {/* Moving through it */}
      <div className="mt-10 flex items-center justify-between gap-4">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-1 text-sm text-stone-500 underline-offset-4 hover:text-stone-700 hover:underline disabled:invisible"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {onNote ? (
          <button
            onClick={finish}
            disabled={finishing}
            className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {finishing ? "Saving…" : "Finish session"}
          </button>
        ) : (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
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
