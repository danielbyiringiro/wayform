"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Records a short voice note with the browser MediaRecorder API and reports
 * the resulting audio blob to the parent. Shows a live timer while recording
 * and an inline preview afterward.
 */
export default function VoiceRecorder({
  onRecorded,
}: {
  onRecorded: (blob: Blob | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startRecording = async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) {
      setError("Voice recording isn’t supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        onRecorded(blob);
        releaseStream();
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access was denied.");
      releaseStream();
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    stopTimer();
    setRecording(false);
  };

  const clearRecording = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSeconds(0);
    onRecorded(null);
  };

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {!previewUrl ? (
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          className={[
            "flex items-center gap-2 self-start rounded-lg px-3.5 py-2 text-sm font-medium transition",
            recording
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "bg-green-50 text-green-700 hover:bg-green-100",
          ].join(" ")}
        >
          {recording ? (
            <>
              <Square className="h-4 w-4 fill-current" />
              Stop · {formatTime(seconds)}
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Record a voice note
            </>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <audio controls src={previewUrl} className="h-9 w-full max-w-xs" />
          <button
            type="button"
            onClick={clearRecording}
            aria-label="Delete recording"
            className="text-stone-400 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
