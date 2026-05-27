import { useState } from 'react';
import type { Task, Profile } from '@/types';

interface ChoreCardProps {
  task: Task;
  profile: Profile;
  subjectProfile?: Profile;  // NEW — who/what the task is about
  onToggleComplete: () => void;
}

function formatDueDate(dueDateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`;

  return `Due ${due.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
}

export default function ChoreCard({ task, profile, subjectProfile, onToggleComplete }: ChoreCardProps) {
  const [justDone, setJustDone] = useState(false);

  const handleToggle = () => {
    if (!task.completed) {
      setJustDone(true);
      setTimeout(() => setJustDone(false), 2000);
    }
    onToggleComplete();
  };

  return (
    <div
      className={[
        'relative rounded-2xl p-6 bg-white shadow-md flex flex-col gap-4 transition-all cursor-pointer',
        task.completed ? 'opacity-60' : '',
        task.is_overdue
          ? 'border-t-4 animate-pulse-border'
          : 'border-t-4',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        borderTopColor: task.is_overdue ? '#ef4444' : profile.colour,
        boxShadow: task.is_overdue
          ? '0 0 0 2px #fca5a5, 0 4px 6px -1px rgba(0,0,0,0.1)'
          : undefined,
      }}
      onClick={handleToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      }}
      aria-label={task.completed ? 'Mark incomplete' : 'Mark done'}
    >
      {/* Per-card celebration overlay */}
      {justDone && (
        <div className="absolute inset-0 flex items-center justify-center bg-green-50/90 rounded-2xl z-10 animate-bounce">
          <span className="text-5xl">⭐</span>
        </div>
      )}

      {/* Profile info */}
      <div className="flex items-center gap-3">
        <span className="text-5xl leading-none" role="img" aria-label={profile.name}>
          {profile.avatar_emoji}
        </span>
        <span className="text-lg font-semibold text-slate-700">{profile.name}</span>

        {/* Subject profile badge — shown when task is ABOUT someone else */}
        {subjectProfile && subjectProfile.id !== profile.id && (
          <span className="text-sm bg-gray-100 rounded-full px-2 py-0.5 ml-2">
            {subjectProfile.avatar_emoji} {subjectProfile.name}
          </span>
        )}
      </div>

      {/* Task title */}
      <div className="flex-1">
        <p
          className={[
            'text-2xl font-semibold leading-snug',
            task.completed ? 'line-through text-slate-400' : 'text-slate-800',
          ].join(' ')}
        >
          {task.title}
        </p>

        {/* Due date */}
        {task.due_date && (
          <p
            className={[
              'mt-2 text-base font-medium',
              task.is_overdue ? 'text-red-600' : 'text-slate-500',
            ].join(' ')}
          >
            {formatDueDate(task.due_date)}
            {task.recurrence_rule && (
              <span className="ml-2 text-slate-400 text-sm font-normal">🔁</span>
            )}
          </p>
        )}

        {/* Overdue badge */}
        {task.is_overdue && (
          <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-sm font-bold text-white bg-red-500">
            Overdue
          </span>
        )}
      </div>

      {/* Done button — still explicit, but whole card is also tappable */}
      <button
        onClick={(e) => {
          // Prevent the card's onClick from firing twice
          e.stopPropagation();
          handleToggle();
        }}
        className={[
          'self-end w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md transition-all active:scale-95',
          task.completed
            ? 'bg-green-500 shadow-green-200'
            : 'bg-yellow-300 hover:bg-green-400 text-slate-700 hover:text-white',
        ].join(' ')}
        style={task.completed ? { boxShadow: '0 0 0 4px #bbf7d0' } : {}}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark done'}
        title={task.completed ? 'Mark incomplete' : 'Mark done'}
      >
        <svg
          className="w-7 h-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12l5 5L20 7" />
        </svg>
      </button>
    </div>
  );
}
