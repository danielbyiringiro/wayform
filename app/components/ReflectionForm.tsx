"use client";

import { useState } from "react";
import VoiceRecorder from "@/components/VoiceRecorder";
import {
  submitReflection,
  uploadVoiceNote,
  type Attempted,
  type Reflection,
} from "@/utils/reflection";

type Mode = "text" | "voice";

function PromptField({
  question,
  mode,
  onMode,
  text,
  onText,
  onBlob,
}: {
  question: string;
  mode: Mode;
  onMode: (m: Mode) => void;
  text: string;
  onText: (t: string) => void;
  onBlob: (b: Blob | null) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-700">{question}</p>
        <div className="inline-flex shrink-0 rounded-lg bg-stone-100 p-0.5 text-xs">
          {(["text", "voice"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMode(m)}
              className={[
                "rounded-md px-2.5 py-1 font-medium transition",
                mode === m
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-stone-500 hover:text-stone-700",
              ].join(" ")}
            >
              {m === "text" ? "Write" : "Voice"}
            </button>
          ))}
        </div>
      </div>

      {mode === "text" ? (
        <textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          rows={3}
          className="mt-3 block w-full resize-none rounded-lg border border-stone-200 bg-white/70 px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          placeholder="Write as much or as little as you like…"
        />
      ) : (
        <div className="mt-3">
          <VoiceRecorder onRecorded={onBlob} />
        </div>
      )}
    </div>
  );
}

export default function ReflectionForm({
  userId,
  day,
  onSubmitted,
}: {
  userId: string;
  day: number;
  onSubmitted: (reflection: Reflection) => void;
}) {
  const [attempted, setAttempted] = useState<Attempted | null>(null);

  const [resistanceMode, setResistanceMode] = useState<Mode>("text");
  const [resistanceText, setResistanceText] = useState("");
  const [resistanceBlob, setResistanceBlob] = useState<Blob | null>(null);

  const [noticedMode, setNoticedMode] = useState<Mode>("text");
  const [noticedText, setNoticedText] = useState("");
  const [noticedBlob, setNoticedBlob] = useState<Blob | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!attempted) {
      setError("Please choose whether you attempted the practice.");
      return;
    }
    if (resistanceMode === "text" && !resistanceText.trim()) {
      setError("Add a note or record a voice note for the resistance prompt.");
      return;
    }
    if (resistanceMode === "voice" && !resistanceBlob) {
      setError("Record a voice note for the resistance prompt, or switch to Write.");
      return;
    }
    if (noticedMode === "text" && !noticedText.trim()) {
      setError("Add a note or record a voice note for the last prompt.");
      return;
    }
    if (noticedMode === "voice" && !noticedBlob) {
      setError("Record a voice note for the last prompt, or switch to Write.");
      return;
    }

    setSubmitting(true);
    try {
      const resistanceAudioPath =
        resistanceMode === "voice" && resistanceBlob
          ? await uploadVoiceNote(userId, day, "resistance", resistanceBlob)
          : null;
      const noticedAudioPath =
        noticedMode === "voice" && noticedBlob
          ? await uploadVoiceNote(userId, day, "noticed", noticedBlob)
          : null;

      const reflection = await submitReflection({
        userId,
        day,
        attempted,
        resistanceText: resistanceMode === "text" ? resistanceText.trim() : null,
        resistanceAudioPath,
        noticedText: noticedMode === "text" ? noticedText.trim() : null,
        noticedAudioPath,
      });

      onSubmitted(reflection);
    } catch {
      setError("Could not save your reflection. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Attempted */}
      <div>
        <p className="text-sm font-medium text-stone-700">
          Did you attempt the practice?
        </p>
        <div className="mt-3 flex gap-2">
          {(
            [
              { value: "yes", label: "Yes" },
              { value: "not_yet", label: "Not yet" },
            ] as { value: Attempted; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAttempted(opt.value)}
              className={[
                "rounded-lg border px-4 py-2 text-sm font-medium transition",
                attempted === opt.value
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-stone-200 bg-white/70 text-stone-600 hover:border-stone-300",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <PromptField
        question="What resistance did you feel?"
        mode={resistanceMode}
        onMode={setResistanceMode}
        text={resistanceText}
        onText={setResistanceText}
        onBlob={setResistanceBlob}
      />

      <PromptField
        question="What did you notice?"
        mode={noticedMode}
        onMode={setNoticedMode}
        text={noticedText}
        onText={setNoticedText}
        onBlob={setNoticedBlob}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full justify-center rounded-lg bg-green-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save reflection"}
      </button>
    </form>
  );
}
