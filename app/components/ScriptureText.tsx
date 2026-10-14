"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findScriptureRefs } from "@/constants/bible";

// Passages don't change, so one fetch per reference lasts the session.
const passageCache = new Map<string, string>();

const MAX_WIDTH = 360;
const GAP = 10; // space between the reference and the popover
const EDGE = 12; // keep this far from the viewport edge
const ROOM_ABOVE = 240; // below this, flip the popover under the reference

interface Position {
  left: number;
  /** One of these is set, depending on which side we opened on. */
  top?: number;
  bottom?: number;
  width: number;
  caretX: number;
  below: boolean;
}

function positionFor(el: HTMLElement): Position {
  const rect = el.getBoundingClientRect();
  const width = Math.min(MAX_WIDTH, window.innerWidth - EDGE * 2);
  const centre = rect.left + rect.width / 2;
  const left = Math.max(
    EDGE,
    Math.min(centre - width / 2, window.innerWidth - width - EDGE),
  );
  const below = rect.top < ROOM_ABOVE;

  return {
    left,
    width,
    caretX: Math.max(14, Math.min(centre - left, width - 14)),
    below,
    // Anchoring by `bottom` when opening upwards means we never have to
    // measure the popover's height before placing it.
    ...(below
      ? { top: rect.bottom + GAP }
      : { bottom: window.innerHeight - rect.top + GAP }),
  };
}

/**
 * The ESV API marks verses inline as "[3]". Render those as small raised
 * numbers so the passage still reads as prose.
 */
export function PassageText({ text }: { text: string }) {
  const parts = text.split(/\[(\d+)\]/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <sup
            key={i}
            className="mr-0.5 align-super text-[0.65em] font-medium text-green-700/70"
          >
            {part}
          </sup>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * Prose with its scripture references turned into buttons. Tapping one floats
 * the passage above the reference, so the reader keeps their place and the
 * paragraph doesn't reflow underneath them.
 */
export default function ScriptureText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [pos, setPos] = useState<Position | null>(null);
  const [passage, setPassage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const anchorRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpenRef(null);
    anchorRef.current = null;
  }, []);

  // Keep the popover stuck to its reference while the page moves.
  useEffect(() => {
    if (!openRef) return;
    const reposition = () => {
      if (anchorRef.current) setPos(positionFor(anchorRef.current));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      close();
    };

    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openRef, close]);

  const toggle = async (
    event: React.MouseEvent<HTMLButtonElement>,
    label: string,
    query: string,
  ) => {
    if (openRef === label) {
      close();
      return;
    }

    anchorRef.current = event.currentTarget;
    setPos(positionFor(event.currentTarget));
    setOpenRef(label);
    setFailed(false);

    const cached = passageCache.get(query);
    if (cached) {
      setPassage(cached);
      return;
    }

    setPassage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/passage?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data?.text) {
        passageCache.set(query, data.text as string);
        setPassage(data.text as string);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const refs = findScriptureRefs(text);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  refs.forEach((ref, i) => {
    if (ref.start > cursor) nodes.push(text.slice(cursor, ref.start));
    nodes.push(
      <button
        key={i}
        type="button"
        onClick={(e) => toggle(e, ref.text, ref.query)}
        className={[
          "font-medium text-green-700 underline decoration-green-700/35",
          "underline-offset-2 transition hover:decoration-green-700",
          openRef === ref.text ? "decoration-green-700" : "",
        ].join(" ")}
      >
        {ref.text}
      </button>,
    );
    cursor = ref.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return (
    <>
      <p className={className}>{nodes}</p>

      {openRef &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={openRef}
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width: pos.width,
            }}
            className="z-50 rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10"
          >
            {/* caret, pointing back at the reference */}
            <span
              style={{ left: pos.caretX }}
              className={[
                "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-stone-200 bg-white",
                pos.below
                  ? "-top-1.5 border-l border-t"
                  : "-bottom-1.5 border-b border-r",
              ].join(" ")}
            />

            <div className="flex items-baseline justify-between gap-4 px-4 pt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-green-700">
                {openRef}
              </p>
              <button
                type="button"
                onClick={close}
                className="shrink-0 text-xs text-stone-400 hover:text-stone-600"
              >
                Close
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto px-4 pb-4 pt-2">
              {loading && <p className="text-sm text-stone-400">Loading…</p>}
              {failed && (
                <p className="text-sm text-stone-500">
                  Couldn&rsquo;t load this passage. Open {openRef} in your own
                  Bible.
                </p>
              )}
              {passage && !loading && (
                <p className="font-serif text-[15px] leading-relaxed text-stone-800">
                  <PassageText text={passage} />
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
