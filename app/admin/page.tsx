"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus, AlertTriangle } from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
  getMyProfile,
  listProfiles,
  listCohorts,
  createCohort,
  updateCohort,
  deleteCohort,
  assignMember,
  removeMember,
  formatSchedule,
  WEEKDAYS,
  type Profile,
  type CohortWithMembers,
} from "@/utils/cohort";

function timeValue(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

type Status = "loading" | "ready" | "error";

export default function AdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [cohorts, setCohorts] = useState<CohortWithMembers[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDay, setNewDay] = useState("");
  const [newTime, setNewTime] = useState("");

  const refresh = useCallback(async () => {
    const [p, c] = await Promise.all([listProfiles(), listCohorts()]);
    setProfiles(p);
    setCohorts(c);
  }, []);

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
        const profile = await getMyProfile(session.user.id);
        if (!profile?.is_admin) {
          router.replace("/loop");
          return;
        }
        await refresh();
        if (active) setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [router, refresh]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  const assignedIds = new Set(
    cohorts.flatMap((c) => c.members.map((m) => m.user_id)),
  );
  const unassigned = profiles.filter((p) => !assignedIds.has(p.id));

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-stone-500">Loading…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="max-w-md text-center text-sm leading-relaxed text-stone-600">
          Could not load admin data. Make sure migration
          0004_cohorts.sql has been run in Supabase.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-24">
        <h1 className="font-serif text-3xl text-stone-800">Cohort management</h1>
        <p className="mt-2 text-sm text-stone-500">
          Assign people to micro-cohorts of 4–6 and set each group’s weekly
          meeting link.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Create cohort */}
        <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="font-semibold text-stone-800">New cohort</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. Tuesday group)"
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
            />
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Meeting link (Zoom URL)"
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-stone-500">Meets</label>
              <select
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
              >
                <option value="">Day…</option>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-stone-500">at</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
              />
            </div>
          </div>
          <button
            disabled={!newName.trim()}
            onClick={() =>
              run(async () => {
                await createCohort(
                  newName.trim(),
                  newUrl.trim(),
                  newDay === "" ? null : Number(newDay),
                  newTime || null,
                );
                setNewName("");
                setNewUrl("");
                setNewDay("");
                setNewTime("");
              })
            }
            className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Create cohort
          </button>
        </section>

        {/* Cohorts */}
        <section className="mt-8 space-y-6">
          {cohorts.length === 0 && (
            <p className="text-sm text-stone-500">No cohorts yet.</p>
          )}
          {cohorts.map((cohort) => (
            <CohortCard
              key={cohort.id}
              cohort={cohort}
              unassigned={unassigned}
              onSave={(fields) => run(() => updateCohort(cohort.id, fields))}
              onDelete={() => run(() => deleteCohort(cohort.id))}
              onAssign={(userId) => run(() => assignMember(cohort.id, userId))}
              onRemove={(userId) => run(() => removeMember(userId))}
            />
          ))}
        </section>

        {/* Unassigned users */}
        <section className="mt-8">
          <h2 className="font-semibold text-stone-800">
            Unassigned people ({unassigned.length})
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <li
                key={p.id}
                className="rounded-full bg-white px-3 py-1 text-sm text-stone-600 ring-1 ring-stone-200"
              >
                {p.email ?? p.id.slice(0, 8)}
              </li>
            ))}
            {unassigned.length === 0 && (
              <li className="text-sm text-stone-400">Everyone is assigned.</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}

function CohortCard({
  cohort,
  unassigned,
  onSave,
  onDelete,
  onAssign,
  onRemove,
}: {
  cohort: CohortWithMembers;
  unassigned: Profile[];
  onSave: (fields: {
    meeting_url: string | null;
    meeting_day: number | null;
    meeting_time: string | null;
  }) => void;
  onDelete: () => void;
  onAssign: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const [url, setUrl] = useState(cohort.meeting_url ?? "");
  const [day, setDay] = useState(
    cohort.meeting_day == null ? "" : String(cohort.meeting_day),
  );
  const [time, setTime] = useState(timeValue(cohort.meeting_time));
  const [pick, setPick] = useState("");

  const count = cohort.members.length;
  const underfilled = count < 4;
  const full = count >= 6;
  const schedulePreview = formatSchedule(
    day === "" ? null : Number(day),
    time || null,
  );

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-stone-800">{cohort.name}</h3>
          <p
            className={[
              "mt-0.5 flex items-center gap-1.5 text-xs",
              underfilled ? "text-amber-600" : "text-stone-500",
            ].join(" ")}
          >
            {underfilled && <AlertTriangle className="h-3.5 w-3.5" />}
            {count} of 4–6 members{full ? " · full" : ""}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="text-stone-400 hover:text-red-600"
          aria-label="Delete cohort"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Meeting details */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-500">Meets</label>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
          >
            <option value="">Day…</option>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-500">at</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
          />
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Meeting link (Zoom URL)"
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600 sm:col-span-2"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() =>
            onSave({
              meeting_url: url.trim() || null,
              meeting_day: day === "" ? null : Number(day),
              meeting_time: time || null,
            })
          }
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Save meeting details
        </button>
        {schedulePreview && (
          <span className="text-xs text-stone-500">{schedulePreview}</span>
        )}
      </div>

      {/* Members */}
      <ul className="mt-4 space-y-2">
        {cohort.members.map((m) => (
          <li
            key={m.user_id}
            className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700"
          >
            <span>{m.email ?? m.user_id.slice(0, 8)}</span>
            <button
              onClick={() => onRemove(m.user_id)}
              className="text-xs text-stone-400 hover:text-red-600"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {/* Add member */}
      {!full && (
        <div className="mt-4 flex gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
          >
            <option value="">Add a person…</option>
            {unassigned.map((p) => (
              <option key={p.id} value={p.id}>
                {p.email ?? p.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <button
            disabled={!pick}
            onClick={() => {
              onAssign(pick);
              setPick("");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Add
          </button>
        </div>
      )}
    </div>
  );
}
