import { Button } from "@/components/ui/button";
import TypewriterTitle from "@/components/ui/TypewriterTitle";
import RedirectIfAuthed from "@/components/RedirectIfAuthed";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <>
      <RedirectIfAuthed />
      <div className="bg-gradient-to-r min-h-screen from-rose-100 to-teal-100">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <h1 className="text-7xl text-center text-green-600 font-bold">
            WayForm
          </h1>
          <div className="mt-4"></div>
          <h2 className="font-semibold text-3xl text-center text-slate-700">
            <TypewriterTitle />
          </h2>
          <div className="mt-8"></div>
          <div className="flex justify-center">
            <Link href="/loop">
              <Button className="bg-green-600 large h-12 px-6">
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" strokeWidth={3} />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
