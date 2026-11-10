"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import {
  updateSchedule,
  clearSchedule,
  nextSessionAt,
  type Pair,
} from "@/utils/pairs";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The viewer's own zone, used to show when the slot lands for them. */
function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** Every zone the browser knows, so we don't ship our own list. */
function allZones(): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  ).supportedValuesOf;
  try {
    if (supported) return supported("timeZone");
  } catch {
    /* fall through */
  }
  return [localZone(), "UTC"];
}

function formatIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

export default function ScheduleCard({
  pair,
  onChanged,
}: {
  pair: Pair;
  onChanged: (pair: Pair) => void;
}) {
  const scheduled = !!pair.session_time && !!pair.session_timezone;

  const [editing, setEditing] = useState(!scheduled);
  const [time, setTime] = useState(pair.session_time?.slice(0, 5) ?? "18:00");
  const [zone, setZone] = useState(pair.session_timezone ?? localZone());
  const [days, setDays] = useState<number[]>(pair.session_days ?? [2, 4, 5]);
  const [next, setNext] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The database works out the next occurrence so this screen and the
  // reminder email can never disagree.
  useEffect(() => {
    if (!scheduled) return;
    let active = true;
    nextSessionAt(pair.id)
      .then((d) => {
        if (active) setNext(d);
      })
      .catch(() => {
        /* leave it unshown rather than guessing client-side */
      });
    return () => {
      active = false;
    };
  }, [pair.id, pair.session_time, pair.session_timezone, pair.session_days, scheduled]);

  const toggleDay = (d: number) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );

  const save = async () => {
    setError(null);
    if (days.length === 0) {
      setError("Pick at least one day.");
      return;
    }
    setBusy(true);
    try {
      const updated = await updateSchedule(pair.id, { time, timezone: zone, days });
      onChanged(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the schedule.");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setError(null);
    setBusy(true);
    try {
      const updated = await clearSchedule(pair.id);
      onChanged(updated);
      setNext(null);
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear the schedule.");
    } finally {
      setBusy(false);
    }
  };

  const viewerZone = localZone();
  const differentZone = scheduled && viewerZone !== pair.session_timezone;

  if (!editing && scheduled) {
    return (
      <div className="rounded-2xl border border-stone-200/70 bg-white/70 p-6">
        <p className="flex items-center gap-2 font-serif text-lg text-stone-800">
          <CalendarClock className="h-4 w-4 text-green-700" />
          You study together
        </p>
        <p className="mt-2 text-sm text-stone-600">
          {pair.session_time?.slice(0, 5)} on{" "}
          {(pair.session_days ?? []).map((d) => DAY_LABELS[d]).join(", ")}
          <span className="text-stone-400"> · {pair.session_timezone}</span>
        </p>

        {next && (
          <div className="mt-4 rounded-xl bg-green-50/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-green-700">
              Next session
            </p>
            <p className="mt-1 text-sm text-stone-700">
              {formatIn(next, pair.session_timezone!)}
            </p>
            {differentZone && (
              <p className="mt-0.5 text-sm text-stone-500">
                {formatIn(next, viewerZone)} your time
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-stone-500 underline-offset-4 hover:text-stone-700 hover:underline"
          >
            Change time
          </button>
          <button
            disabled={busy}
            onClick={clear}
            className="text-sm text-stone-400 underline-offset-4 hover:text-stone-600 hover:underline"
          >
            Remove schedule
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white/70 p-6">
      <p className="flex items-center gap-2 font-serif text-lg text-stone-800">
        <CalendarClock className="h-4 w-4 text-green-700" />
        When will you study together?
      </p>
      <p className="mt-2 text-sm text-stone-500">
        Pick one time and the days it applies to. If you&rsquo;re in different
        places, this is the zone it&rsquo;s counted in &mdash; your partner
        sees their own local time.
      </p>

      <div className="mt-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-stone-500">At</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
          />
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
          >
            {allZones().map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 text-xs text-stone-500">On</p>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, d) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(d)}
                className={[
                  "rounded-lg border px-3 py-1.5 text-sm transition",
                  days.includes(d)
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-300",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          disabled={busy}
          onClick={save}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save schedule"}
        </button>
        {scheduled && (
          <button
            onClick={() => setEditing(false)}
            className="text-sm text-stone-500 underline-offset-4 hover:text-stone-700 hover:underline"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
