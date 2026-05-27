import { useState } from 'react';
import type { Task, Profile } from '@/types';

interface TaskItemProps {
  task: Task;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function formatDueDate(dueDateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays === -1) return 'Due yesterday';
  if (diffDays < 0) return `Due ${Math.abs(diffDays)} days ago`;

  return `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export default function TaskItem({ task, onToggleComplete, onEdit, onDelete }: TaskItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const profile = task.profile as Profile | undefined;
  const profileColour = profile?.colour ?? '#94a3b8';

  // subject_profile will be present once types/index.ts is updated by the other agent
  const subjectProfile = (task as unknown as { subject_profile?: Profile }).subject_profile;

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      // Auto-cancel confirm state after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      className={[
        'flex items-center gap-3 bg-white rounded-lg shadow-sm border border-gray-100 p-3 mb-2',
        task.is_overdue ? 'border-l-4 border-l-red-500 bg-red-50' : '',
        task.completed ? 'opacity-60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Profile colour dot */}
      <span
        className="flex-shrink-0 w-2 h-2 rounded-full"
        style={{ backgroundColor: profileColour }}
        title={profile?.name ?? 'Unknown'}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={[
              'text-sm font-medium text-slate-800 truncate',
              task.completed ? 'line-through text-slate-400' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {task.title}
          </span>

          {/* Subject profile badge — shown when task is ABOUT a different profile */}
          {subjectProfile && subjectProfile.id !== profile?.id && (
            <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 ml-1 flex-shrink-0">
              {subjectProfile.avatar_emoji}
            </span>
          )}

          {task.recurrence_rule && (
            <span className="flex-shrink-0 text-[10px] text-slate-400" title="Recurring task">🔁</span>
          )}
          {task.is_overdue && (
            <span className="flex-shrink-0 text-xs font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
              Overdue
            </span>
          )}
        </div>
        {task.due_date && (
          <p className="text-xs text-slate-400 mt-0.5">{formatDueDate(task.due_date)}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Complete toggle — checkbox style */}
        <button
          onClick={onToggleComplete}
          className={[
            'w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
            task.completed
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-slate-300 hover:border-green-400',
          ].join(' ')}
          title={task.completed ? 'Mark incomplete' : 'Mark complete'}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.completed && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
            </svg>
          )}
        </button>

        {/* Edit */}
        <button
          onClick={onEdit}
          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
          title="Edit task"
          aria-label="Edit task"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
            />
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={handleDeleteClick}
          className={[
            'h-7 flex items-center justify-center rounded transition-colors text-xs font-medium',
            confirmDelete
              ? 'px-2 bg-red-500 text-white hover:bg-red-600'
              : 'w-7 text-slate-400 hover:text-red-500 hover:bg-red-50',
          ].join(' ')}
          title={confirmDelete ? 'Click again to confirm delete' : 'Delete task'}
          aria-label={confirmDelete ? 'Confirm delete' : 'Delete task'}
        >
          {confirmDelete ? (
            'Delete?'
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
