"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";

/**
 * Sends already-signed-in visitors to the daily loop, making the loop the
 * default place for returning users while the landing page stays for guests.
 */
export default function RedirectIfAuthed({ to = "/loop" }: { to?: string }) {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(to);
    });
  }, [router, to]);

  return null;
}
