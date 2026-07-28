"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";

/**
 * Landing point after an OAuth redirect. supabase-js parses the session from
 * the returned URL automatically; we just wait for it and forward to the loop.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      router.replace("/loop");
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish();
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) finish();
      },
    );

    // If nothing resolves within a few seconds, the sign-in didn't complete.
    const timeout = setTimeout(() => {
      if (!settled) setFailed(true);
    }, 8000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50 px-6">
      {failed ? (
        <div className="text-center">
          <p className="text-stone-600">We couldn’t complete sign-in.</p>
          <button
            onClick={() => router.replace("/signin")}
            className="mt-3 text-sm font-semibold text-green-700 underline-offset-4 hover:underline"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <p className="font-serif text-stone-500">Signing you in…</p>
      )}
    </main>
  );
}
