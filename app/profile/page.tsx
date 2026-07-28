"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Church, Compass } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { getMyProfile, updateChurch, type ChurchStatus } from "@/utils/cohort";

type Status = "loading" | "ready" | "error";

export default function ProfilePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [choice, setChoice] = useState<ChurchStatus | null>(null);
  const [churchName, setChurchName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setUserId(session.user.id);
      setEmail(session.user.email ?? null);
      try {
        const profile = await getMyProfile(session.user.id);
        if (!active) return;
        setChoice(profile?.church_status ?? null);
        setChurchName(profile?.church_name ?? "");
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
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

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await updateChurch(userId, choice, churchName.trim() || null);
      setSavedMsg("Saved.");
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-24">
        <header className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-green-700/80">
            Your Profile
          </p>
          <h1 className="mt-3 font-serif text-3xl text-stone-800">
            Church home
          </h1>
          {email && <p className="mt-2 text-sm text-stone-500">{email}</p>}
        </header>

        {status === "loading" && (
          <p className="mt-12 text-center text-sm text-stone-400">Loading…</p>
        )}

        {status === "error" && (
          <p className="mx-auto mt-12 max-w-md text-center text-sm leading-relaxed text-stone-600">
            Could not load your profile. Make sure migration 0007_church.sql has
            been run in Supabase.
          </p>
        )}

        {status === "ready" && (
          <div className="mt-12">
            <p className="text-sm leading-relaxed text-stone-500">
              WayForm doesn’t replace the local church. If you have a church
              home, name it below — or mark that you’re still exploring. This is
              encouraged, but entirely optional.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setChoice("attending")}
                className={[
                  "flex items-center gap-3 rounded-xl border p-4 text-left transition",
                  choice === "attending"
                    ? "border-green-600 bg-green-50"
                    : "border-stone-200 bg-white/70 hover:border-stone-300",
                ].join(" ")}
              >
                <Church className="h-5 w-5 text-green-700" />
                <span className="text-sm font-medium text-stone-800">
                  I attend a local church
                </span>
              </button>

              <button
                type="button"
                onClick={() => setChoice("exploring")}
                className={[
                  "flex items-center gap-3 rounded-xl border p-4 text-left transition",
                  choice === "exploring"
                    ? "border-green-600 bg-green-50"
                    : "border-stone-200 bg-white/70 hover:border-stone-300",
                ].join(" ")}
              >
                <Compass className="h-5 w-5 text-green-700" />
                <span className="text-sm font-medium text-stone-800">
                  I’m exploring
                </span>
              </button>
            </div>

            {choice === "attending" && (
              <div className="mt-5">
                <label
                  htmlFor="church"
                  className="mb-1.5 block text-sm font-medium text-stone-600"
                >
                  Which church?
                </label>
                <input
                  id="church"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  placeholder="e.g. Grace Community Church"
                  className="block w-full rounded-lg border border-stone-200 bg-white/70 px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                />
              </div>
            )}

            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {choice && (
                <button
                  onClick={() => {
                    setChoice(null);
                    setChurchName("");
                  }}
                  className="text-sm text-stone-400 underline-offset-4 hover:text-stone-600 hover:underline"
                >
                  Clear
                </button>
              )}
              {savedMsg && (
                <span className="text-sm text-green-700">{savedMsg}</span>
              )}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
