import { supabase } from "@/utils/supabase";

export type ChurchStatus = "attending" | "exploring";

export interface Profile {
  id: string;
  email: string | null;
  is_admin: boolean;
  church_status?: ChurchStatus | null;
  church_name?: string | null;
}

export interface Cohort {
  id: string;
  name: string;
  meeting_url: string | null;
  meeting_day: number | null; // 0 = Sunday … 6 = Saturday
  meeting_time: string | null; // "HH:MM[:SS]"
  created_at: string;
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Human-readable weekly schedule, e.g. "Wednesdays at 7:00 PM". */
export function formatSchedule(
  day: number | null,
  time: string | null,
): string | null {
  if (day == null || !time) return null;
  const weekday = WEEKDAYS[day];
  if (!weekday) return null;
  const [hStr, mStr] = time.split(":");
  const hour = Number(hStr);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${weekday}s at ${hour12}:${mStr ?? "00"} ${suffix}`;
}

export interface CohortMember {
  user_id: string;
  email: string | null;
  pair_id: string;
}

export interface CohortWithMembers extends Cohort {
  members: CohortMember[];
}

/** A pair (active only) for admin assignment, with both partners' emails. */
export interface PairSummary {
  id: string;
  members: { user_id: string; email: string | null }[];
}

/** The signed-in user's own profile (includes the admin flag). */
export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, is_admin, church_status, church_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

/** Any profile visible to the caller under RLS (self, partner, or cohort-mate). */
export async function getProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, is_admin, church_status, church_name")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

/** Update the user's optional church selection. */
export async function updateChurch(
  userId: string,
  status: ChurchStatus | null,
  name: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      church_status: status,
      church_name: status === "attending" ? name || null : null,
    })
    .eq("id", userId);
  if (error) throw error;
}

// --- Shared helpers: pairs -> members, with emails looked up separately ---
// (pairs.user_a/user_b reference auth.users, not wayform.profiles directly,
// so PostgREST can't embed profiles through a pair in one round trip.)

type PairRow = { id: string; user_a: string; user_b: string | null };

async function emailsFor(userIds: string[]): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", unique);
  if (error) throw error;
  const map = new Map<string, string | null>();
  for (const row of (data as { id: string; email: string | null }[]) ?? []) {
    map.set(row.id, row.email);
  }
  return map;
}

function pairMembers(
  pair: PairRow,
  emails: Map<string, string | null>,
): CohortMember[] {
  const ids = [pair.user_a, pair.user_b].filter((id): id is string => !!id);
  return ids.map((id) => ({
    user_id: id,
    email: emails.get(id) ?? null,
    pair_id: pair.id,
  }));
}

/** The user's cohort with its member list (grouped by pair), or null. */
export async function getMyCohort(): Promise<CohortWithMembers | null> {
  const { data: cohort, error } = await supabase
    .from("cohorts")
    .select("id, name, meeting_url, meeting_day, meeting_time, created_at")
    .maybeSingle();
  if (error) throw error;
  if (!cohort) return null;

  const { data: cohortPairs, error: cpError } = await supabase
    .from("cohort_pairs")
    .select("pair_id, pairs(id, user_a, user_b)")
    .eq("cohort_id", cohort.id);
  if (cpError) throw cpError;

  const pairs = ((cohortPairs ?? []) as unknown as { pairs: PairRow | PairRow[] }[])
    .map((row) => (Array.isArray(row.pairs) ? row.pairs[0] : row.pairs))
    .filter((p): p is PairRow => !!p);

  const emails = await emailsFor(pairs.flatMap((p) => [p.user_a, p.user_b].filter(Boolean) as string[]));

  return { ...(cohort as Cohort), members: pairs.flatMap((p) => pairMembers(p, emails)) };
}

// --- Admin helpers -------------------------------------------------------

/** Active pairs available for cohort assignment (admin only). */
export async function listPairs(): Promise<PairSummary[]> {
  const { data, error } = await supabase
    .from("pairs")
    .select("id, user_a, user_b")
    .eq("status", "active")
    .order("created_at");
  if (error) throw error;

  const rows = (data as PairRow[]) ?? [];
  const emails = await emailsFor(rows.flatMap((p) => [p.user_a, p.user_b].filter(Boolean) as string[]));

  return rows.map((p) => ({
    id: p.id,
    members: [p.user_a, p.user_b]
      .filter((id): id is string => !!id)
      .map((id) => ({ user_id: id, email: emails.get(id) ?? null })),
  }));
}

/** All cohorts with their assigned pairs (admin only). */
export async function listCohorts(): Promise<CohortWithMembers[]> {
  const { data: cohorts, error } = await supabase
    .from("cohorts")
    .select("id, name, meeting_url, meeting_day, meeting_time, created_at")
    .order("created_at");
  if (error) throw error;

  const { data: cohortPairs, error: cpError } = await supabase
    .from("cohort_pairs")
    .select("cohort_id, pairs(id, user_a, user_b)");
  if (cpError) throw cpError;

  const rows = (cohortPairs ?? []) as unknown as {
    cohort_id: string;
    pairs: PairRow | PairRow[];
  }[];
  const allPairs = rows
    .map((r) => (Array.isArray(r.pairs) ? r.pairs[0] : r.pairs))
    .filter((p): p is PairRow => !!p);
  const emails = await emailsFor(
    allPairs.flatMap((p) => [p.user_a, p.user_b].filter(Boolean) as string[]),
  );

  return ((cohorts as Cohort[]) ?? []).map((cohort) => {
    const pairsForCohort = rows
      .filter((r) => r.cohort_id === cohort.id)
      .map((r) => (Array.isArray(r.pairs) ? r.pairs[0] : r.pairs))
      .filter((p): p is PairRow => !!p);
    return {
      ...cohort,
      members: pairsForCohort.flatMap((p) => pairMembers(p, emails)),
    };
  });
}

export async function createCohort(
  name: string,
  meetingUrl: string,
  meetingDay: number | null,
  meetingTime: string | null,
): Promise<Cohort> {
  const { data, error } = await supabase
    .from("cohorts")
    .insert({
      name,
      meeting_url: meetingUrl || null,
      meeting_day: meetingDay,
      meeting_time: meetingTime || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Cohort;
}

export async function updateCohort(
  cohortId: string,
  fields: {
    name?: string;
    meeting_url?: string | null;
    meeting_day?: number | null;
    meeting_time?: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("cohorts")
    .update(fields)
    .eq("id", cohortId);
  if (error) throw error;
}

export async function deleteCohort(cohortId: string): Promise<void> {
  const { error } = await supabase.from("cohorts").delete().eq("id", cohortId);
  if (error) throw error;
}

/** Assign a pair to a cohort (throws if the cohort already has 3 pairs). */
export async function assignPair(
  cohortId: string,
  pairId: string,
): Promise<void> {
  const { error } = await supabase
    .from("cohort_pairs")
    .insert({ cohort_id: cohortId, pair_id: pairId });
  if (error) throw error;
}

export async function removePair(pairId: string): Promise<void> {
  const { error } = await supabase
    .from("cohort_pairs")
    .delete()
    .eq("pair_id", pairId);
  if (error) throw error;
}
