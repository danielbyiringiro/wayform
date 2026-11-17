import { supabase } from "@/utils/supabase";

export interface PairSession {
  id: string;
  pair_id: string;
  day_index: number;
  scheduled_for: string | null;
  started_by: string | null;
  started_at: string;
  completed_at: string | null;
  note: string | null;
  note_author: string | null;
}

/**
 * The session for a given study day, creating it the first time either
 * partner opens it. Unique on (pair_id, day_index), so whoever arrives
 * second joins the same row rather than starting a second session.
 */
export async function getOrCreateSession(
  pairId: string,
  dayIndex: number,
  userId: string,
): Promise<PairSession> {
  const { data: existing, error: findError } = await supabase
    .from("pair_sessions")
    .select("*")
    .eq("pair_id", pairId)
    .eq("day_index", dayIndex)
    .maybeSingle();

  if (findError) throw new Error(findError.message);
  if (existing) return existing as PairSession;

  const { data, error } = await supabase
    .from("pair_sessions")
    .insert({ pair_id: pairId, day_index: dayIndex, started_by: userId })
    .select()
    .single();

  // Both partners can open the session at the same moment; the loser of
  // that race just reads the row the winner made.
  if (error) {
    const { data: raced } = await supabase
      .from("pair_sessions")
      .select("*")
      .eq("pair_id", pairId)
      .eq("day_index", dayIndex)
      .maybeSingle();
    if (raced) return raced as PairSession;
    throw new Error(error.message);
  }

  return data as PairSession;
}

/** Save the shared note, recording who wrote it. */
export async function saveNote(
  sessionId: string,
  note: string,
  authorId: string,
): Promise<void> {
  const { error } = await supabase
    .from("pair_sessions")
    .update({ note, note_author: authorId })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

/** Mark the session finished. The day then counts as done for both. */
export async function completeSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("pair_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}
