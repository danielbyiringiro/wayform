import { supabase } from "@/utils/supabase";

const BUCKET = "voice-notes";

export type Attempted = "yes" | "not_yet";
export type Prompt = "resistance" | "change" | "noticed";

export interface Reflection {
  id: string;
  pair_id: string;
  user_id: string;
  day_index: number;
  attempted: Attempted;
  resistance_text: string | null;
  resistance_audio_path: string | null;
  change_text: string | null;
  change_audio_path: string | null;
  noticed_text: string | null;
  noticed_audio_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReflectionInput {
  pairId: string;
  userId: string;
  dayIndex: number;
  attempted: Attempted;
  resistanceText?: string | null;
  resistanceAudioPath?: string | null;
  changeText?: string | null;
  changeAudioPath?: string | null;
  noticedText?: string | null;
  noticedAudioPath?: string | null;
}

/** The caller's own reflection for a given day, or null if none yet. */
export async function getReflection(
  pairId: string,
  userId: string,
  dayIndex: number,
): Promise<Reflection | null> {
  const { data, error } = await supabase
    .from("pair_reflections")
    .select("*")
    .eq("pair_id", pairId)
    .eq("user_id", userId)
    .eq("day_index", dayIndex)
    .maybeSingle();

  if (error) throw error;
  return (data as Reflection | null) ?? null;
}

/** Both partners' reflections for a given day (whichever have been submitted). */
export async function getPairReflections(
  pairId: string,
  dayIndex: number,
): Promise<Reflection[]> {
  const { data, error } = await supabase
    .from("pair_reflections")
    .select("*")
    .eq("pair_id", pairId)
    .eq("day_index", dayIndex);

  if (error) throw error;
  return (data as Reflection[]) ?? [];
}

/** Upload a recorded voice note to private storage and return its path. */
export async function uploadVoiceNote(
  userId: string,
  pairId: string,
  dayIndex: number,
  prompt: Prompt,
  blob: Blob,
): Promise<string> {
  const path = `${userId}/${pairId}/day-${dayIndex}/${prompt}-${Date.now()}.webm`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true });

  if (error) throw error;
  return path;
}

/** Create (or replace) the caller's reflection for a day. */
export async function submitReflection(
  input: ReflectionInput,
): Promise<Reflection> {
  const row = {
    pair_id: input.pairId,
    user_id: input.userId,
    day_index: input.dayIndex,
    attempted: input.attempted,
    resistance_text: input.resistanceText ?? null,
    resistance_audio_path: input.resistanceAudioPath ?? null,
    change_text: input.changeText ?? null,
    change_audio_path: input.changeAudioPath ?? null,
    noticed_text: input.noticedText ?? null,
    noticed_audio_path: input.noticedAudioPath ?? null,
  };

  const { data, error } = await supabase
    .from("pair_reflections")
    .upsert(row, { onConflict: "pair_id,user_id,day_index" })
    .select()
    .single();

  if (error) throw error;
  return data as Reflection;
}

/** Signed, time-limited URL for playing back a stored voice note. */
export async function getSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  if (error) return null;
  return data?.signedUrl ?? null;
}
