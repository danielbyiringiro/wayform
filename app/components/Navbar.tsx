"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase";
import { getMyProfile } from "@/utils/cohort";
import { Button } from "@/components/ui/button";

export default function Navbar({ session }: { session: Session | null }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!session) return;
    let active = true;
    getMyProfile(session.user.id)
      .then((p) => {
        if (active) setIsAdmin(!!p?.is_admin);
      })
      .catch(() => {
        /* ignore — treat as non-admin */
      });
    return () => {
      active = false;
    };
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link
          href={session ? "/loop" : "/"}
          className="text-xl font-bold text-green-600"
        >
          WayForm
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          {session ? (
            <>
              <Link href="/cohort">
                <Button variant="ghost" size="sm">
                  Cohort
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="sm">
                  Profile
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm">
                    Admin
                  </Button>
                </Link>
              )}
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {session.user.email}
              </span>
              <Button size="sm" variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <Link href="/signin">
              <Button className="bg-green-600" size="sm">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
