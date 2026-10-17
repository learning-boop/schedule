import { TopBar } from "@/components/top-bar";
import { GoalList } from "@/components/goals/goal-list";

export default function GoalsPage() {
  return (
    <>
      <TopBar title="Goals" />
      <div className="mx-auto w-full max-w-3xl p-6">
        <GoalList />
      </div>
    </>
  );
}
