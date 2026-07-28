"use client";

import { useEffect, useState } from "react";
import { getSignedUrl, type Reflection } from "@/utils/reflection";

function AnswerFromPath({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSignedUrl(path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return <p className="text-sm text-stone-400">Loading voice note…</p>;
  }
  return <audio controls src={url} className="mt-1 h-9 w-full max-w-xs" />;
}

function Answer({
  question,
  text,
  audioPath,
}: {
  question: string;
  text: string | null;
  audioPath: string | null;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-500">{question}</p>
      {audioPath ? (
        <AnswerFromPath path={audioPath} />
      ) : (
        <p className="mt-1 whitespace-pre-line text-stone-700">{text}</p>
      )}
    </div>
  );
}

export default function ReflectionSummary({
  reflection,
}: {
  reflection: Reflection;
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-stone-200/70 bg-white/60 p-5">
      <div>
        <p className="text-sm font-medium text-stone-500">
          Did you attempt the practice?
        </p>
        <p className="mt-1 text-stone-700">
          {reflection.attempted === "yes" ? "Yes" : "Not yet"}
        </p>
      </div>

      <Answer
        question="What resistance did you feel?"
        text={reflection.resistance_text}
        audioPath={reflection.resistance_audio_path}
      />

      <Answer
        question="What did you notice?"
        text={reflection.noticed_text}
        audioPath={reflection.noticed_audio_path}
      />
    </div>
  );
}
