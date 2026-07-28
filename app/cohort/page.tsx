"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Video, CalendarClock } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { getMyCohort, formatSchedule, type CohortWithMembers } from "@/utils/cohort";

type Status = "loading" | "ready" | "error";

export default function CohortPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [cohort, setCohort] = useState<CohortWithMembers | null>(null);
  const [myEmail, setMyEmail] = useState<string | null>(null);

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
      setMyEmail(session.user.email ?? null);
      try {
        const c = await getMyCohort();
        if (!active) return;
        setCohort(c);
        setStatus("ready");
      } catch {
        if (!active) return;
        setStatus("error");
      }
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) router.replace("/signin");
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-24">
        <header className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-green-700/80">
            Your Cohort
          </p>
          <h1 className="mt-3 font-serif text-3xl text-stone-800">
            Walking together
          </h1>
        </header>

        {status === "loading" && (
          <p className="mt-12 text-center text-sm text-stone-400">
            Loading your cohort…
          </p>
        )}

        {status === "error" && (
          <p className="mx-auto mt-12 max-w-md text-center text-sm leading-relaxed text-stone-600">
            Could not load your cohort. Make sure the cohorts tables have been
            created in Supabase (see supabase/migrations/0004_cohorts.sql).
          </p>
        )}

        {status === "ready" && !cohort && (
          <div className="mt-12 rounded-2xl border border-stone-200/70 bg-white/60 p-8 text-center">
            <Users className="mx-auto h-6 w-6 text-stone-400" />
            <p className="mt-3 font-serif text-lg text-stone-700">
              You’re not in a cohort yet.
            </p>
            <p className="mt-2 text-sm text-stone-500">
              A guide will place you in a small group of 4–6 people soon. Keep
              walking through your daily loop in the meantime.
            </p>
          </div>
        )}

        {status === "ready" && cohort && (
          <div className="mt-12 space-y-8">
            <div className="rounded-2xl border border-stone-200/70 bg-white/70 p-6">
              <h2 className="font-serif text-xl text-stone-800">
                {cohort.name}
              </h2>

              {formatSchedule(cohort.meeting_day, cohort.meeting_time) && (
                <p className="mt-3 flex items-center gap-2 text-sm text-stone-600">
                  <CalendarClock className="h-4 w-4 text-green-700" />
                  {formatSchedule(cohort.meeting_day, cohort.meeting_time)} · 30
                  minutes
                </p>
              )}

              {cohort.meeting_url ? (
                <a
                  href={cohort.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                >
                  <Video className="h-4 w-4" />
                  Join the weekly session
                </a>
              ) : (
                <p className="mt-5 text-sm text-stone-400">
                  A meeting link will appear here once your guide adds one.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
                Members
              </p>
              <ul className="mt-4 space-y-2">
                {cohort.members.map((m) => (
                  <li
                    key={m.user_id}
                    className="flex items-center justify-between rounded-lg border border-stone-200/70 bg-white/50 px-4 py-2.5 text-sm text-stone-700"
                  >
                    <span>{m.email ?? "Member"}</span>
                    {m.email === myEmail && (
                      <span className="text-xs text-stone-400">You</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-stone-400">
                Your cohort is private. What’s shared here stays among these
                members — there are no public feeds.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
