import { supabase } from "@/utils/supabase";
import { TRACK_ID } from "@/constants/track";

const BUCKET = "voice-notes";

export type Attempted = "yes" | "not_yet";
export type Prompt = "resistance" | "noticed";

export interface Reflection {
  id: string;
  user_id: string;
  track_id: string;
  day: number;
  attempted: Attempted;
  resistance_text: string | null;
  resistance_audio_path: string | null;
  noticed_text: string | null;
  noticed_audio_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReflectionInput {
  userId: string;
  day: number;
  attempted: Attempted;
  resistanceText?: string | null;
  resistanceAudioPath?: string | null;
  noticedText?: string | null;
  noticedAudioPath?: string | null;
}

/** Fetch the user's reflection for a given day, or null if none yet. */
export async function getReflection(
  userId: string,
  day: number,
): Promise<Reflection | null> {
  const { data, error } = await supabase
    .from("reflections")
    .select("*")
    .eq("user_id", userId)
    .eq("track_id", TRACK_ID)
    .eq("day", day)
    .maybeSingle();

  if (error) throw error;
  return (data as Reflection | null) ?? null;
}

/** Upload a recorded voice note to private storage and return its path. */
export async function uploadVoiceNote(
  userId: string,
  day: number,
  prompt: Prompt,
  blob: Blob,
): Promise<string> {
  const path = `${userId}/${TRACK_ID}/day-${day}/${prompt}-${Date.now()}.webm`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true });

  if (error) throw error;
  return path;
}

/** Create (or replace) the reflection for a day. */
export async function submitReflection(
  input: ReflectionInput,
): Promise<Reflection> {
  const row = {
    user_id: input.userId,
    track_id: TRACK_ID,
    day: input.day,
    attempted: input.attempted,
    resistance_text: input.resistanceText ?? null,
    resistance_audio_path: input.resistanceAudioPath ?? null,
    noticed_text: input.noticedText ?? null,
    noticed_audio_path: input.noticedAudioPath ?? null,
  };

  const { data, error } = await supabase
    .from("reflections")
    .upsert(row, { onConflict: "user_id,track_id,day" })
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
