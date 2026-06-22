"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/utils/supabase";

export default function SignIn() {
  const session = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (session) {
      router.replace("/loop");
    }
  }, [session, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        // Email confirmation disabled: user is signed in immediately.
        router.replace("/loop");
      } else {
        setMessage(
          "Check your email for the confirmation link to finish signing up.",
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.replace("/loop");
      }
    }
    setLoading(false);
  };

  const inputClasses =
    "block w-full rounded-lg border border-stone-200 bg-white/70 px-3.5 py-2.5 text-base text-stone-800 placeholder:text-stone-400 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20 sm:text-sm";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50 px-6 py-16">
      <div className="w-full max-w-sm">
        {/* Wordmark + invitation */}
        <div className="text-center">
          <p className="font-serif text-3xl font-semibold text-green-700">
            WayForm
          </p>
          <p className="mt-2 text-sm text-stone-500">
            {isSignUp
              ? "Begin your formation journey."
              : "Welcome back. Continue your journey."}
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-2xl border border-stone-200/70 bg-white/70 p-7 shadow-sm backdrop-blur">
          <h1 className="text-center font-serif text-xl text-stone-800">
            {isSignUp ? "Create your account" : "Sign in"}
          </h1>

          <form className="mt-6 space-y-5" onSubmit={handleAuth}>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-stone-600"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-stone-600"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClasses}
              />
            </div>

            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}
            {message && (
              <p className="text-center text-sm text-green-700">{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-lg bg-green-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50"
            >
              {loading
                ? "Please wait…"
                : isSignUp
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-stone-500">
          {isSignUp ? "Already have an account? " : "New to WayForm? "}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage(null);
            }}
            className="font-semibold text-green-700 underline-offset-4 hover:underline"
          >
            {isSignUp ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </main>
  );
}
