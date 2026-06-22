import { supabase } from "@/utils/supabase";
import { TRACK_ID, TRACK_LENGTH } from "@/constants/track";

export interface Progress {
  user_id: string;
  track_id: string;
  current_day: number;
  started_at: string;
  updated_at: string;
}

/**
 * Fetch the user's progress row, creating one at day 1 if it does not exist
 * yet (i.e. their first time entering the track).
 */
export async function getOrCreateProgress(
  userId: string,
): Promise<Progress> {
  const { data, error } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as Progress;

  const { data: created, error: insertError } = await supabase
    .from("user_progress")
    .insert({ user_id: userId, track_id: TRACK_ID, current_day: 1 })
    .select()
    .single();

  if (insertError) throw insertError;
  return created as Progress;
}

/**
 * Advance the user to the next day, capped at the final day of the track.
 * Returns the updated progress row.
 */
export async function advanceDay(
  userId: string,
  currentDay: number,
): Promise<Progress> {
  const next = Math.min(currentDay + 1, TRACK_LENGTH);

  const { data, error } = await supabase
    .from("user_progress")
    .update({ current_day: next })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as Progress;
}
