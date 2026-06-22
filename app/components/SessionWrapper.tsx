"use client";

import { useSession } from "@/hooks/useSession";
import Navbar from "@/components/Navbar";

export default function SessionWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useSession();

  return (
    <>
      <Navbar session={session} />
      {children}
    </>
  );
}
