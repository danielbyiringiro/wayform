"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Heart, LogOut } from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
  getMyPair,
  createInvite,
  acceptInvite,
  dissolvePair,
  choosePlan,
  type Pair,
} from "@/utils/pairs";
import { getProfileById } from "@/utils/cohort";
import { BIBLE_BOOKS } from "@/constants/bible";
import type { PlanType } from "@/constants/plan";
import { planLabel, planTotalDays } from "@/constants/plan";

type Status = "loading" | "ready" | "error";

export default function PairPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [pair, setPair] = useState<Pair | null>(null);
  const [partnerEmail, setPartnerEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (uid: string) => {
    const p = await getMyPair(uid);
    setPair(p);
    if (p?.status === "active") {
      const partnerId = p.user_a === uid ? p.user_b : p.user_a;
      if (partnerId) {
        const profile = await getProfileById(partnerId);
        setPartnerEmail(profile?.email ?? null);
      }
    } else {
      setPartnerEmail(null);
    }
  };

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
        setUserId(session.user.id);
        await load(session.user.id);
        if (active) setStatus("ready");
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

  const refresh = async () => {
    if (userId) await load(userId);
  };

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="font-serif text-stone-500">Loading your pair…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="max-w-md text-center text-sm leading-relaxed text-stone-600">
          Could not load your pair. Make sure migration
          0011_pairs_and_study_plans.sql has been run in Supabase.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-24">
        <header className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-green-700/80">
            Your Pair
          </p>
          <h1 className="mt-3 font-serif text-3xl text-stone-800">
            Study together
          </h1>
        </header>

        {error && (
          <p className="mx-auto mt-6 max-w-md rounded-lg bg-red-50 px-4 py-2.5 text-center text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-12">
          {!pair && userId && (
            <NoPair
              userId={userId}
              onError={setError}
              onChanged={refresh}
            />
          )}

          {pair && pair.status === "pending" && (
            <PendingPair
              pair={pair}
              onError={setError}
              onDissolved={refresh}
            />
          )}

          {pair && pair.status === "active" && !pair.plan_type && (
            <ChoosePlan
              pair={pair}
              onError={setError}
              onChosen={refresh}
            />
          )}

          {pair && pair.status === "active" && pair.plan_type && (
            <ActivePair
              pair={pair}
              partnerEmail={partnerEmail}
              onError={setError}
              onDissolved={refresh}
              onGoToLoop={() => router.push("/loop")}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white/70 p-6">
      {children}
    </div>
  );
}

function NoPair({
  userId,
  onError,
  onChanged,
}: {
  userId: string;
  onError: (e: string | null) => void;
  onChanged: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    onError(null);
    setBusy(true);
    try {
      await createInvite(userId);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not create an invite.");
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    onError(null);
    if (!code.trim()) {
      onError("Enter the invite code your partner shared with you.");
      return;
    }
    setBusy(true);
    try {
      await acceptInvite(code, userId);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not accept that invite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <Heart className="h-5 w-5 text-green-700" />
        <p className="mt-3 font-serif text-lg text-stone-800">
          Invite a study partner
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Bible study on Wayform happens as a pair. Invite the person you want
          to study with — a friend, spouse, or sibling.
        </p>
        <button
          disabled={busy}
          onClick={invite}
          className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create an invite"}
        </button>
      </Card>

      <Card>
        <p className="font-serif text-lg text-stone-800">
          Have an invite code?
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Enter the code your partner shared with you to form your pair.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 4F2AC91B"
            className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm uppercase tracking-wider outline-none focus:border-green-600"
          />
          <button
            disabled={busy}
            onClick={accept}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Join
          </button>
        </div>
      </Card>
    </div>
  );
}

function PendingPair({
  pair,
  onError,
  onDissolved,
}: {
  pair: Pair;
  onError: (e: string | null) => void;
  onDissolved: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pair.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the code is still shown on screen */
    }
  };

  const cancel = async () => {
    onError(null);
    setBusy(true);
    try {
      await dissolvePair(pair.id);
      onDissolved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not cancel the invite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <p className="font-serif text-lg text-stone-800">
        Waiting for your partner
      </p>
      <p className="mt-2 text-sm text-stone-500">
        Share this code with the person you&rsquo;re studying with. Once they enter
        it, your pair becomes active.
      </p>
      <div className="mt-5 flex items-center justify-center gap-3">
        <span className="rounded-lg bg-stone-100 px-4 py-2.5 font-mono text-lg tracking-[0.2em] text-stone-800">
          {pair.invite_code}
        </span>
        <button
          onClick={copy}
          className="rounded-lg border border-stone-300 p-2.5 text-stone-600 hover:bg-stone-50"
          aria-label="Copy invite code"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      {copied && (
        <p className="mt-2 text-center text-xs text-green-700">Copied.</p>
      )}
      <button
        disabled={busy}
        onClick={cancel}
        className="mt-6 text-sm text-stone-400 underline-offset-4 hover:text-stone-600 hover:underline"
      >
        Cancel this invite
      </button>
    </Card>
  );
}

function ChoosePlan({
  pair,
  onError,
  onChosen,
}: {
  pair: Pair;
  onError: (e: string | null) => void;
  onChosen: () => void;
}) {
  const [type, setType] = useState<PlanType>("absg");
  const [book, setBook] = useState(BIBLE_BOOKS[0].name);
  const [startChapter, setStartChapter] = useState(1);
  const [endChapter, setEndChapter] = useState(1);
  const [busy, setBusy] = useState(false);

  const bookChapters =
    BIBLE_BOOKS.find((b) => b.name === book)?.chapters ?? 1;

  const submit = async () => {
    onError(null);
    const config =
      type === "chapter_a_day"
        ? { book }
        : type === "custom_range"
          ? { book, startChapter, endChapter }
          : {};

    if (type === "custom_range" && startChapter > endChapter) {
      onError("The starting chapter must come before the ending chapter.");
      return;
    }

    setBusy(true);
    try {
      await choosePlan(pair.id, type, config);
      onChosen();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save your plan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <p className="font-serif text-lg text-stone-800">Choose your study</p>
      <p className="mt-2 text-sm text-stone-500">
        You&rsquo;re paired up. Now pick how you&rsquo;ll study scripture together.
      </p>

      <div className="mt-5 space-y-3">
        {(
          [
            {
              value: "absg" as const,
              title: "ABSG",
              desc: "This week's SDA Sabbath School Adult Bible Study Guide section.",
            },
            {
              value: "chapter_a_day" as const,
              title: "Bible Chapter a Day",
              desc: "Read straight through a book, one chapter per day.",
            },
            {
              value: "custom_range" as const,
              title: "Custom Passage Range",
              desc: "Pick your own book and chapter range, at your own pace.",
            },
          ]
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setType(opt.value)}
            className={[
              "block w-full rounded-xl border p-4 text-left transition",
              type === opt.value
                ? "border-green-600 bg-green-50"
                : "border-stone-200 bg-white hover:border-stone-300",
            ].join(" ")}
          >
            <p className="text-sm font-semibold text-stone-800">{opt.title}</p>
            <p className="mt-1 text-xs text-stone-500">{opt.desc}</p>
          </button>
        ))}
      </div>

      {(type === "chapter_a_day" || type === "custom_range") && (
        <div className="mt-5 space-y-3 rounded-xl bg-stone-50 p-4">
          <div>
            <label className="mb-1 block text-xs text-stone-500">Book</label>
            <select
              value={book}
              onChange={(e) => {
                setBook(e.target.value);
                setStartChapter(1);
                setEndChapter(1);
              }}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
            >
              {BIBLE_BOOKS.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} ({b.chapters} chapters)
                </option>
              ))}
            </select>
          </div>

          {type === "custom_range" && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-stone-500">
                  From chapter
                </label>
                <input
                  type="number"
                  min={1}
                  max={bookChapters}
                  value={startChapter}
                  onChange={(e) => setStartChapter(Number(e.target.value))}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-stone-500">
                  To chapter
                </label>
                <input
                  type="number"
                  min={1}
                  max={bookChapters}
                  value={endChapter}
                  onChange={(e) => setEndChapter(Number(e.target.value))}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-green-600"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <button
        disabled={busy}
        onClick={submit}
        className="mt-5 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Start this plan"}
      </button>
    </Card>
  );
}

function ActivePair({
  pair,
  partnerEmail,
  onError,
  onDissolved,
  onGoToLoop,
}: {
  pair: Pair;
  partnerEmail: string | null;
  onError: (e: string | null) => void;
  onDissolved: () => void;
  onGoToLoop: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const total = pair.plan_type ? planTotalDays(pair.plan_type, pair.plan_config) : 0;

  const leave = async () => {
    onError(null);
    if (!confirm("End this pair? Your partner will need a new invite to pair again.")) {
      return;
    }
    setBusy(true);
    try {
      await dissolvePair(pair.id);
      onDissolved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not end the pair.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <p className="font-serif text-lg text-stone-800">
        Paired with {partnerEmail ?? "your partner"}
      </p>
      <p className="mt-2 text-sm text-stone-500">
        {pair.plan_type && planLabel(pair.plan_type)}
        {total > 0 && ` · Day ${pair.current_index} of ${total}`}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          onClick={onGoToLoop}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          Go to today&rsquo;s loop
        </button>
        <button
          disabled={busy}
          onClick={leave}
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 underline-offset-4 hover:text-red-600 hover:underline"
        >
          <LogOut className="h-3.5 w-3.5" />
          End this pair
        </button>
      </div>
    </Card>
  );
}
