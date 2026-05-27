import { WeeklyMealPlanner } from '@/components/MealPlanner';

export default function MealPlannerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 px-1">Meal Planner</h1>
      <div className="card">
        <WeeklyMealPlanner />
      </div>
    </div>
  );
}
