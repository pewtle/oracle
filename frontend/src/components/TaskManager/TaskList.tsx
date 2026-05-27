import { useState, useEffect, useCallback } from 'react';
import type { Task } from '@/types';
import { tasksApi } from '@/api/client';
import { useProfiles } from '@/contexts/ProfileContext';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';

type FilterTab = 'all' | number; // 'all' or profile id
type TimeFilter = 'all' | 'today' | 'week' | 'overdue';

export default function TaskList() {
  const { profiles, loading: profilesLoading } = useProfiles();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  // Always fetch ALL tasks at once; filter locally to avoid per-tab round trips
  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const data = await tasksApi.getAll();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
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
      console.error('Failed to toggle task:', err);
    }
  };

  const handleDelete = async (task: Task) => {
    try {
      await tasksApi.remove(task.id);
      fetchTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTask(undefined);
  };

  const handleFormSaved = () => {
    fetchTasks();
  };

  // Delete all recently-completed tasks and refetch
  const handleClearCompleted = async (recentlyCompleted: Task[]) => {
    try {
      await Promise.all(recentlyCompleted.map((t) => tasksApi.remove(t.id)));
      fetchTasks();
    } catch (err) {
      console.error('Failed to clear completed tasks:', err);
    }
  };

  // -------------------------------------------------------------------------
  // Filtering helpers
  // -------------------------------------------------------------------------

  // Apply profile tab filter
  function applyProfileFilter(allTasks: Task[]): Task[] {
    if (activeTab === 'all') return allTasks;
    return allTasks.filter((t) => t.profile_id === (activeTab as number));
  }

  // Apply temporal filter
  function applyTimeFilter(taskList: Task[]): Task[] {
    const today = new Date().toISOString().split('T')[0];
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    switch (timeFilter) {
      case 'today':
        return taskList.filter((t) => t.due_date === today);
      case 'week':
        return taskList.filter((t) => t.due_date && t.due_date <= weekEndStr);
      case 'overdue':
        return taskList.filter((t) => t.is_overdue);
      default:
        return taskList;
    }
  }

  // -------------------------------------------------------------------------
  // Derived task lists
  // -------------------------------------------------------------------------

  // Start with all tasks, apply both filters, then split into active/completed
  const profileFiltered = applyProfileFilter(tasks);
  const filteredTasks = applyTimeFilter(profileFiltered);

  const activeTasks = filteredTasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      // Overdue first
      if (a.is_overdue && !b.is_overdue) return -1;
      if (!a.is_overdue && b.is_overdue) return 1;
      // Then by due date ascending (tasks with no due date last)
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      return 0;
    });

  const allCompletedTasks = filteredTasks.filter((t) => t.completed);

  // Auto-hide completed tasks older than 7 days
  const recentlyCompleted = allCompletedTasks.filter((t) => {
    if (!t.completed_at) return true;
    const days = (Date.now() - new Date(t.completed_at).getTime()) / 86400000;
    return days <= 7;
  });
  const hasOlderCompleted = allCompletedTasks.length > recentlyCompleted.length;

  if (profilesLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div>
      {/* Temporal filter row */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {(['all', 'today', 'week', 'overdue'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setTimeFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              timeFilter === f
                ? f === 'overdue'
                  ? 'bg-red-500 text-white'
                  : 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all'
              ? 'All'
              : f === 'today'
              ? 'Due Today'
              : f === 'week'
              ? 'This Week'
              : '🔴 Overdue'}
          </button>
        ))}
      </div>

      {/* Top bar: profile filter tabs + Add Task button */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {/* Profile filter tabs */}
        <div className="flex items-center gap-1 flex-wrap flex-1">
          <button
            onClick={() => setActiveTab('all')}
            className={[
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              activeTab === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            ].join(' ')}
          >
            All
          </button>
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveTab(p.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                activeTab === p.id
                  ? 'text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
              style={activeTab === p.id ? { backgroundColor: p.colour } : {}}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: activeTab === p.id ? 'rgba(255,255,255,0.7)' : p.colour }}
              />
              {p.name}
            </button>
          ))}
        </div>

        {/* Add Task */}
        <button
          onClick={() => {
            setEditingTask(undefined);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Task
        </button>
      </div>

      {/* Task lists */}
      {tasksLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
          Loading tasks…
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-lg font-medium text-slate-500">No tasks yet</p>
          <p className="text-sm mt-1">Add a task using the button above.</p>
        </div>
      ) : (
        <div>
          {/* Active section */}
          <section className="mb-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Active{activeTasks.length > 0 ? ` (${activeTasks.length})` : ''}
            </h3>
            {activeTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                <span className="text-3xl mb-2">All done! 🎉</span>
                <p className="text-sm">No active tasks remaining.</p>
              </div>
            ) : (
              <div>
                {activeTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={() => handleToggleComplete(task)}
                    onEdit={() => handleEdit(task)}
                    onDelete={() => handleDelete(task)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Completed section (collapsible) */}
          {allCompletedTasks.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setCompletedExpanded((prev) => !prev)}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${completedExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  Completed ({recentlyCompleted.length})
                </button>

                {/* Clear all completed button */}
                {completedExpanded && recentlyCompleted.length > 0 && (
                  <button
                    onClick={() => handleClearCompleted(recentlyCompleted)}
                    className="text-sm text-red-500 hover:text-red-700 ml-auto"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {completedExpanded && (
                <div>
                  {recentlyCompleted.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggleComplete={() => handleToggleComplete(task)}
                      onEdit={() => handleEdit(task)}
                      onDelete={() => handleDelete(task)}
                    />
                  ))}
                  {hasOlderCompleted && (
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      Older completed tasks are hidden.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Task form modal */}
      {showForm && (
        <TaskForm
          task={editingTask}
          profiles={profiles}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  );
}
