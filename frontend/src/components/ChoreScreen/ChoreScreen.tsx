import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Profile } from '@/types';
import { tasksApi } from '@/api/client';
import { useProfiles } from '@/contexts/ProfileContext';
import ChoreCard from './ChoreCard';

export default function ChoreScreen() {
  const navigate = useNavigate();
  const { profiles, loading: profilesLoading } = useProfiles();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      // Fetch all tasks (both complete and incomplete) so we can show completed state
      const data = await tasksApi.getAll();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks for chore screen:', err);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Auto-refresh every 60 seconds when the page is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchTasks();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleToggleComplete = async (task: Task) => {
    try {
      if (task.completed) {
        await tasksApi.uncomplete(task.id);
      } else {
        await tasksApi.complete(task.id);
      }
      fetchTasks();
    } catch (err) {
      console.error('Failed to toggle chore:', err);
    }
  };

  const loading = profilesLoading || tasksLoading;

  const todayStr = new Date().toISOString().slice(0, 10);
  // Only show active (incomplete) tasks that are due today or earlier (or have no due date)
  const activeTasks = tasks.filter(
    (t) => !t.completed && (!t.due_date || t.due_date <= todayStr)
  );

  // Build profile sections — only HUMAN profiles that are responsible for at least one active task.
  // Group by profile_id (the responsible person), never by subject_profile_id.
  // A profile appears here only if it is directly assigned a task (profile_id match).
  const profilesWithTasks = profiles.filter((p) =>
    activeTasks.some((t) => t.profile_id === p.id)
  );

  // Check if all tasks across all profiles are done
  // (only meaningful once loaded and there are tasks)
  const totalTasks = tasks.length;
  const allDone = !loading && totalTasks > 0 && activeTasks.length === 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#F8FAFC' }}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold text-primary-600 tracking-tight">Odysseus</span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-lg hover:bg-slate-200 transition-colors"
        >
          🏠 Home
        </button>
      </header>

      {/* Page heading */}
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-4xl font-bold text-slate-800">✅ Tasks</h1>
        {!loading && (
          <>
            <p className="text-2xl text-slate-500 mt-1">
              {activeTasks.length === 0
                ? 'All tasks complete!'
                : `${activeTasks.length} task${activeTasks.length !== 1 ? 's' : ''} remaining`}
            </p>
            {totalTasks > 0 && (
              <div className="mt-3 w-full max-w-sm">
                <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-green-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(((totalTasks - activeTasks.length) / totalTasks) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Content */}
      <main className="flex-1 px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 text-xl">
            Loading…
          </div>
        ) : allDone ? (
          /* All done celebration */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="text-8xl mb-6 animate-bounce"
              role="img"
              aria-label="celebration"
            >
              🎉
            </div>
            <h2 className="text-5xl font-bold text-green-600 mb-3">All done!</h2>
            <p className="text-2xl text-slate-600">Amazing work, everyone!</p>
            <div className="flex gap-4 mt-4 text-5xl">
              <span>⭐</span>
              <span>🌟</span>
              <span>✨</span>
            </div>
            <button
              onClick={() => navigate('/')}
              className="mt-8 px-10 py-5 text-2xl font-bold text-white bg-green-500 hover:bg-green-600 rounded-2xl shadow-lg transition-colors"
            >
              🏠 Go home!
            </button>
          </div>
        ) : profilesWithTasks.length === 0 ? (
          /* No tasks at all */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-3xl font-bold text-slate-600 mb-2">No tasks yet!</h2>
            <p className="text-xl text-slate-400">
              Add tasks in the Task Manager to see them here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {profilesWithTasks.map((profile: Profile) => {
              const profileActiveTasks = activeTasks
                .filter((t) => t.profile_id === profile.id)
                .sort((a, b) => {
                  // Overdue first
                  if (a.is_overdue && !b.is_overdue) return -1;
                  if (!a.is_overdue && b.is_overdue) return 1;
                  if (a.due_date && !b.due_date) return -1;
                  if (!a.due_date && b.due_date) return 1;
                  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
                  return 0;
                });

              if (profileActiveTasks.length === 0) return null;

              return (
                <section key={profile.id}>
                  {/* Profile section header — always the RESPONSIBLE person */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl leading-none">{profile.avatar_emoji}</span>
                    <h2
                      className="text-2xl font-bold"
                      style={{ color: profile.colour }}
                    >
                      {profile.name}
                    </h2>
                    <span className="text-lg text-slate-400 font-medium">
                      {profileActiveTasks.length} task{profileActiveTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Chore cards grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {profileActiveTasks.map((task) => (
                      <ChoreCard
                        key={task.id}
                        task={task}
                        profile={profile}
                        subjectProfile={(task as unknown as { subject_profile?: Profile }).subject_profile}
                        onToggleComplete={() => handleToggleComplete(task)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
