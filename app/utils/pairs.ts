import { supabase } from "@/utils/supabase";
import type { PlanType, PlanConfig } from "@/constants/plan";

export interface Pair {
  id: string;
  user_a: string;
  user_b: string | null;
  status: "pending" | "active" | "dissolved";
  invite_code: string;
  plan_type: PlanType | null;
  plan_config: PlanConfig;
  plan_started_at: string | null;
  current_index: number;
  current_index_started_at: string;
  /** Local time of the pair's session, in session_timezone. */
  session_time: string | null;
  /** IANA zone the slot was set in — 6pm Friday there may be Saturday here. */
  session_timezone: string | null;
  /** 0 = Sunday … 6 = Saturday, in session_timezone. */
  session_days: number[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * The pair is time-spaced like the old solo track: the next day only unlocks
 * on a later calendar day (local time) than the day the current one started.
 */
export function isNextDayUnlocked(currentIndexStartedAt: string): boolean {
  const started = new Date(currentIndexStartedAt);
  const now = new Date();
  const startedMidnight = new Date(
    started.getFullYear(),
    started.getMonth(),
    started.getDate(),
  );
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return nowMidnight.getTime() > startedMidnight.getTime();
}

/** The caller's own pair (pending or active), or null if they have none. */
export async function getMyPair(userId: string): Promise<Pair | null> {
  const { data, error } = await supabase
    .from("pairs")
    .select("*")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .neq("status", "dissolved")
    .maybeSingle();

  if (error) throw error;
  return (data as Pair | null) ?? null;
}

/** Start a new pair as its owner, generating a shareable invite code. */
export async function createInvite(userId: string): Promise<Pair> {
  const { data, error } = await supabase
    .from("pairs")
    .insert({ user_a: userId })
    .select()
    .single();

  if (error) throw error;
  return data as Pair;
}

/** Redeem someone else's invite code, forming an active pair. */
/** What someone holding an invite code can see before they have an account. */
export interface InvitePreview {
  id: string;
  plan_type: PlanType | null;
  plan_config: PlanConfig;
  current_index: number;
  inviter_name: string | null;
}

/**
 * Look up an invite without being signed in. Goes through a database function
 * because pending pairs aren't readable directly — holding the code is what
 * grants access to this one row.
 */
export async function previewInvite(
  code: string,
): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc("pair_by_invite", {
    p_code: code.trim(),
  });
  if (error) throw error;
  const row = (data as InvitePreview[] | null)?.[0];
  return row ?? null;
}

/** Redeem an invite code, joining the inviter's study where they left off. */
export async function acceptInvite(code: string): Promise<void> {
  const { error } = await supabase.rpc("accept_invite", {
    p_code: code.trim(),
  });
  if (error) throw new Error(error.message);
}

/** Leave/end the pair. Kept as history, not deleted. */
export async function dissolvePair(pairId: string): Promise<void> {
  const { error } = await supabase
    .from("pairs")
    .update({ status: "dissolved" })
    .eq("id", pairId);
  if (error) throw error;
}

/** Choose (or change) the pair's active study plan, restarting at day 1. */
export async function choosePlan(
  pairId: string,
  planType: PlanType,
  planConfig: PlanConfig,
): Promise<Pair> {
  const { data, error } = await supabase
    .from("pairs")
    .update({
      plan_type: planType,
      plan_config: planConfig,
      plan_started_at: new Date().toISOString(),
      current_index: 1,
      current_index_started_at: new Date().toISOString(),
    })
    .eq("id", pairId)
    .select()
    .single();

  if (error) throw error;
  return data as Pair;
}

/** Advance to the next day, capped at the plan's total length. */
export async function advancePairDay(
  pairId: string,
  currentIndex: number,
  totalDays: number,
): Promise<Pair> {
  const next = Math.min(currentIndex + 1, totalDays);

  const { data, error } = await supabase
    .from("pairs")
    .update({
      current_index: next,
      current_index_started_at: new Date().toISOString(),
    })
    .eq("id", pairId)
    .select()
    .single();

  if (error) throw error;
  return data as Pair;
}

// --- Session schedule -------------------------------------------------------

export interface SessionSlot {
  time: string; // "18:00"
  timezone: string; // IANA name
  days: number[]; // 0 = Sunday … 6 = Saturday
}

/** Set (or change) when the pair meets. */
export async function updateSchedule(
  pairId: string,
  slot: SessionSlot,
): Promise<Pair> {
  const { data, error } = await supabase
    .from("pairs")
    .update({
      session_time: slot.time,
      session_timezone: slot.timezone,
      session_days: slot.days,
    })
    .eq("id", pairId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Pair;
}

/** Drop the schedule entirely; the pair goes back to studying ad hoc. */
export async function clearSchedule(pairId: string): Promise<Pair> {
  const { data, error } = await supabase
    .from("pairs")
    .update({ session_time: null, session_timezone: null, session_days: null })
    .eq("id", pairId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Pair;
}

/**
 * When the next session falls. Worked out by the database so the reminder
 * job and the screen can never disagree about it.
 */
export async function nextSessionAt(pairId: string): Promise<Date | null> {
  const { data, error } = await supabase.rpc("pair_next_session", {
    p_pair_id: pairId,
  });
  if (error) throw new Error(error.message);
  return data ? new Date(data as string) : null;
}
