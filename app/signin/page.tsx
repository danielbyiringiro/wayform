"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/utils/supabase";

type Provider = "google" | "github";

export default function SignIn() {
  const session = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace("/loop");
  }, [session, router]);

  const signInWith = async (provider: Provider) => {
    setError(null);
    setLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
    // On success the browser is redirected to the provider, so no further
    // work happens here.
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50 px-6 py-16">
      <div className="w-full max-w-sm">
        {/* Wordmark + invitation */}
        <div className="text-center">
          <p className="font-serif text-3xl font-semibold text-green-700">
            WayForm
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Continue your formation journey.
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-2xl border border-stone-200/70 bg-white/70 p-7 shadow-sm backdrop-blur">
          <h1 className="text-center font-serif text-xl text-stone-800">
            Sign in
          </h1>
          <p className="mt-1 text-center text-sm text-stone-500">
            Use your Google or GitHub account.
          </p>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => signInWith("google")}
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
            >
              <GoogleIcon />
              {loading === "google" ? "Redirecting…" : "Continue with Google"}
            </button>

            <button
              onClick={() => signInWith("github")}
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-50"
            >
              <GitHubIcon />
              {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
            </button>
          </div>

          {error && (
            <p className="mt-5 text-center text-sm text-red-600">{error}</p>
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-stone-400">
          New here? Signing in with Google or GitHub creates your account
          automatically.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 1.27a11 11 0 0 0-3.48 21.46c.55.09.73-.24.73-.53v-1.85c-3.03.66-3.67-1.46-3.67-1.46-.5-1.27-1.21-1.6-1.21-1.6-.99-.68.07-.66.07-.66 1.1.08 1.67 1.13 1.67 1.13.98 1.67 2.57 1.19 3.2.91.1-.71.38-1.19.69-1.46-2.42-.28-4.96-1.21-4.96-5.38 0-1.19.42-2.16 1.13-2.92-.11-.28-.49-1.39.11-2.9 0 0 .92-.29 3.02 1.11a10.5 10.5 0 0 1 5.5 0c2.1-1.4 3.02-1.11 3.02-1.11.6 1.51.22 2.62.11 2.9.7.76 1.13 1.73 1.13 2.92 0 4.18-2.55 5.1-4.98 5.37.39.34.74 1 .74 2.03v3.01c0 .29.19.63.74.52A11 11 0 0 0 12 1.27Z" />
    </svg>
  );
}
