import Link from "next/link";
import {
  Target,
  Calendar,
  BarChart3,
  Users,
  FileDown,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Goals & Actions",
    desc: "Set up to 10 goals with sub-goals, action checklists, and deadlines. Track progress visually.",
  },
  {
    icon: Calendar,
    title: "Hourly Calendar",
    desc: "Plan your day hour by hour. Drag to create blocks, link them to goals, mark done with work notes.",
  },
  {
    icon: CheckCircle,
    title: "Daily Planning",
    desc: "Top 3 priorities, Eisenhower matrix, water & fitness trackers, and an auto-generated done log.",
  },
  {
    icon: BarChart3,
    title: "Reports & Charts",
    desc: "Hours by goal, planned vs actual, goal progress, and your Goal #1 streak. Export any table as CSV.",
  },
  {
    icon: Users,
    title: "Team Views",
    desc: "See what everyone is working on right now. Team week view, manager dashboard, and read-only colleague schedules.",
  },
  {
    icon: FileDown,
    title: "PDF Workbook",
    desc: "Export your planner as a print-ready A4 PDF. Goals, monthly plan, weekly slots, and daily pages.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold tracking-tight">Schedule Planner</span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Plan your work.
          <br />
          <span className="text-primary">See your team.</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A personal planner that works for the whole company. Set goals, plan every hour, track
          progress, and see what your team is doing — all in one place.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start Free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Free for teams up to 5. No credit card required.
        </p>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold mb-10">
            Everything you need to stay on track
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-lg border bg-card p-5">
                <f.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold mb-8">How it works</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground mb-3">
                1
              </div>
              <h3 className="font-semibold mb-1">Sign up & create your company</h3>
              <p className="text-sm text-muted-foreground">
                The founder creates the org and invites managers.
              </p>
            </div>
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground mb-3">
                2
              </div>
              <h3 className="font-semibold mb-1">Invite your team</h3>
              <p className="text-sm text-muted-foreground">
                Managers invite employees. Everyone gets their own planner.
              </p>
            </div>
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground mb-3">
                3
              </div>
              <h3 className="font-semibold mb-1">Plan, execute, review</h3>
              <p className="text-sm text-muted-foreground">
                Set goals, plan your hours, and see the whole team's progress.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30 py-16 text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to get organised?</h2>
        <p className="text-muted-foreground mb-6">Free for teams of 5. No credit card needed.</p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create Your Team <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-muted-foreground">
          <span>Schedule Planner by Creative Touch</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
