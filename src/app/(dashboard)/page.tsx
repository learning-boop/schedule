import { TopBar } from "@/components/top-bar";
import { GoalOneCard } from "@/components/dashboard/goal-one-card";
import { OnboardingRedirect } from "@/components/onboarding/onboarding-redirect";

export default function DashboardPage() {
  return (
    <>
      <TopBar title="Dashboard" />
      <OnboardingRedirect />
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <GoalOneCard />
      </div>
    </>
  );
}
