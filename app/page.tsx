import { Button } from "@/components/ui/button";
import RedirectIfAuthed from "@/components/RedirectIfAuthed";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const STEPS = [
  {
    n: "1",
    title: "Pair up",
    body: "Invite one person with a code, a friend, spouse, or sibling. Not a group, not a feed. Just the two of you.",
  },
  {
    n: "2",
    title: "Choose your study",
    body: "Pick the plan that fits you both. You can switch later without starting over as a pair.",
  },
  {
    n: "3",
    title: "Read, practice, reflect",
    body: "Five to seven minutes a day. You each answer the same few questions, and your answers stay between the two of you.",
  },
];

const PLANS = [
  {
    title: "ABSG",
    body: "This week's Sabbath School Adult Bible Study Guide section, the same one the church is studying.",
  },
  {
    title: "A chapter a day",
    body: "Read straight through a book of the Bible, one chapter at a time, at your own pace.",
  },
  {
    title: "Your own passage",
    body: "Choose any book and chapter range and work through it together.",
  },
];

export default function Home() {
  return (
    <>
      <RedirectIfAuthed />
      <main className="min-h-screen bg-gradient-to-b from-amber-50/50 via-stone-50 to-stone-50">
        <div className="mx-auto max-w-2xl px-6 pb-24 pt-28">
          {/* Hero */}
          <header className="text-center">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-green-700/80">
              Bible study for two
            </p>
            <h1 className="mt-4 font-serif text-5xl text-stone-800">WayForm</h1>
            <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-stone-600">
              Scripture is easier to stay with when one other person is doing it
              alongside you. WayForm pairs you with someone, just one, to read,
              practice, and reflect together, a few minutes a day.
            </p>

            <div className="mt-9 flex justify-center">
              <Link href="/signin">
                <Button className="h-12 bg-green-600 px-6 hover:bg-green-700">
                  Get started
                  <ArrowRight className="ml-2 h-5 w-5" strokeWidth={3} />
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-stone-500">
              You&rsquo;ll need a partner. Sign in first, then share an invite
              code with them.
            </p>
          </header>

          {/* How it works */}
          <section className="mt-20">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
              How it works
            </h2>
            <div className="mt-6 space-y-4">
              {STEPS.map((step) => (
                <div
                  key={step.n}
                  className="flex gap-4 rounded-2xl border border-stone-200/70 bg-white/70 p-6"
                >
                  <span className="font-serif text-2xl text-green-700/70">
                    {step.n}
                  </span>
                  <div>
                    <p className="font-serif text-lg text-stone-800">
                      {step.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Plans */}
          <section className="mt-16">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
              Three ways to study
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.title}
                  className="rounded-2xl border border-stone-200/70 bg-white/70 p-5"
                >
                  <p className="font-serif text-base text-stone-800">
                    {plan.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">
                    {plan.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Weekly cohort */}
          <section className="mt-16 rounded-2xl border border-stone-200/70 bg-white/70 p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
              At the end of the week
            </h2>
            <p className="mt-4 leading-relaxed text-stone-600">
              Your pair joins two others for a 30-minute guided session, four
              to six people, the same faces each week. You share what you&rsquo;re
              learning, not your private reflections.
            </p>
          </section>

          <p className="mt-16 text-center text-sm leading-relaxed text-stone-400">
            WayForm doesn&rsquo;t replace your local church. It walks alongside
            it.
          </p>
        </div>
      </main>
    </>
  );
}
