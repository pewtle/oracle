import { Link } from 'react-router-dom';
import TaskList from '@/components/TaskManager/TaskList';

export default function TasksPage() {
  return (
    <div className="space-y-4">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tasks</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Manage to-dos and tasks for each family member.
          </p>
        </div>
        <Link
          to="/chores"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-sm hover:bg-amber-100 transition-colors"
          title="Open Task Screen"
        >
          <span className="text-lg">⭐</span>
          Task Screen
        </Link>
      </div>

      {/* Task list */}
      <TaskList />
    </div>
  );
}
