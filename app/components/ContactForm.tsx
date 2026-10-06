"use client";

import { useState } from "react";

type State = "idle" | "sending" | "sent" | "error";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: humans never fill this
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email, and message.");
      return;
    }

    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not send your message.");
      setState("sent");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setState("error");
      setError(
        err instanceof Error ? err.message : "Could not send your message.",
      );
    }
  };

  if (state === "sent") {
    return (
      <p className="rounded-2xl border border-green-700/20 bg-green-50/60 p-6 text-center leading-relaxed text-stone-700">
        Thanks — your message is on its way. You&rsquo;ll get a reply at the
        address you gave.
      </p>
    );
  }

  const field =
    "w-full rounded-lg border border-stone-200 bg-white/70 px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={100}
          className={field}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          maxLength={200}
          className={field}
        />
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="What&rsquo;s on your mind?"
        maxLength={4000}
        className={`${field} resize-none`}
      />

      {/* Honeypot, hidden from people but inviting to bots. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
