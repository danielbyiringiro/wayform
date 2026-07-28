"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Church, X } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { getMyProfile } from "@/utils/cohort";

const DISMISS_KEY = "wayform:church-nudge-dismissed";

/**
 * A one-time, dismissable prompt inviting new users to set a church home.
 * Shows only when the user hasn't chosen a church status yet and hasn't
 * dismissed it before (remembered per-device in localStorage).
 */
export default function ChurchNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY)) {
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const profile = await getMyProfile(session.user.id);
        if (active && !profile?.church_status) setShow(true);
      } catch {
        /* stay quiet on error */
      }
    };
    check();
    return () => {
      active = false;
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="mx-auto mb-10 flex max-w-xl items-start gap-3 rounded-xl border border-green-200/70 bg-green-50/70 px-4 py-3">
      <Church className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-stone-800">Do you have a church home?</p>
        <p className="mt-0.5 text-stone-600">
          WayForm walks alongside your local church — name one, or mark that
          you’re exploring. It only takes a moment, and it’s optional.
        </p>
        <div className="mt-2 flex items-center gap-4">
          <Link
            href="/profile"
            onClick={dismiss}
            className="font-semibold text-green-700 underline-offset-4 hover:underline"
          >
            Set church home
          </Link>
          <button
            onClick={dismiss}
            className="text-stone-500 hover:text-stone-700"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-stone-400 hover:text-stone-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
