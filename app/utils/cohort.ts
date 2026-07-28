import { supabase } from "@/utils/supabase";

export interface Profile {
  id: string;
  email: string | null;
  is_admin: boolean;
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
}

export interface CohortWithMembers extends Cohort {
  members: CohortMember[];
}

/** The signed-in user's own profile (includes the admin flag). */
export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

// PostgREST embeds a to-one relationship, but supabase-js infers it as an
// array in some versions — accept either shape.
type EmbeddedProfile =
  | { email: string | null }
  | { email: string | null }[]
  | null;
type MemberRow = { user_id: string; profiles: EmbeddedProfile };

function profileEmail(p: EmbeddedProfile): string | null {
  if (!p) return null;
  return Array.isArray(p) ? (p[0]?.email ?? null) : p.email;
}

function toMembers(rows: MemberRow[] | null | undefined): CohortMember[] {
  return (rows ?? []).map((m) => ({
    user_id: m.user_id,
    email: profileEmail(m.profiles),
  }));
}

/** The user's cohort with its member list, or null if unassigned. */
export async function getMyCohort(): Promise<CohortWithMembers | null> {
  const { data, error } = await supabase
    .from("cohorts")
    .select(
      "id, name, meeting_url, meeting_day, meeting_time, created_at, cohort_members(user_id, profiles(email))",
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { cohort_members, ...cohort } = data as unknown as Cohort & {
    cohort_members: MemberRow[];
  };
  return { ...cohort, members: toMembers(cohort_members) };
}

// --- Admin helpers -------------------------------------------------------

/** All profiles (admin only — RLS returns nothing for non-admins). */
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, is_admin")
    .order("email");
  if (error) throw error;
  return (data as Profile[]) ?? [];
}

/** All cohorts with members (admin only). */
export async function listCohorts(): Promise<CohortWithMembers[]> {
  const { data, error } = await supabase
    .from("cohorts")
    .select(
      "id, name, meeting_url, meeting_day, meeting_time, created_at, cohort_members(user_id, profiles(email))",
    )
    .order("created_at");
  if (error) throw error;

  return (
    (data as unknown as (Cohort & { cohort_members: MemberRow[] })[]) ?? []
  ).map(({ cohort_members, ...cohort }) => ({
    ...cohort,
    members: toMembers(cohort_members),
  }));
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

/** Assign a user to a cohort (throws if the cohort already has 6 members). */
export async function assignMember(
  cohortId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("cohort_members")
    .insert({ cohort_id: cohortId, user_id: userId });
  if (error) throw error;
}

export async function removeMember(userId: string): Promise<void> {
  const { error } = await supabase
    .from("cohort_members")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}
