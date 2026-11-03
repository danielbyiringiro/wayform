"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import ScriptureText from "@/components/ScriptureText";

export interface Block {
  kind: "text" | "question" | "heading" | "quote";
  text: string;
}

export interface AbsgData {
  quarterTitle: string;
  coverUrl: string;
  weekTitle: string;
  dayTitle: string;
  weekNumber: number;
  dayOfWeek: number;
  date: string; // YYYY-MM-DD
  blocks: Block[];
  additionalTitle: string | null;
  additional: Block[];
}

/** One lesson block, styled by kind the way the printed guide sets them. */
export default function LessonBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "question":
      return (
        <div className="rounded-2xl border border-green-700/20 bg-green-50/50 p-5">
          <ScriptureText
            text={block.text}
            className="font-medium leading-relaxed text-stone-800"
          />
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-green-700/30 pl-5">
          <ScriptureText
            text={block.text}
            className="whitespace-pre-line font-serif text-lg italic leading-loose text-stone-700"
          />
        </blockquote>
      );
    case "heading":
      return <p className="font-serif text-xl text-stone-800">{block.text}</p>;
    default:
      return (
        <ScriptureText
          text={block.text}
          className="whitespace-pre-line font-serif text-lg leading-loose text-stone-800"
        />
      );
  }
}

/** Supplementary material, tucked behind a disclosure like the printed guide. */
export function AdditionalReading({
  title,
  blocks,
}: {
  title: string;
  blocks: Block[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 rounded-2xl border border-stone-200/70 bg-white/50">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-stone-700">{title}</span>
        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-stone-400 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {open && (
        <div className="space-y-5 border-t border-stone-200/70 px-5 pb-6 pt-5">
          {blocks.map((block, i) => (
            <LessonBlock key={i} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}
