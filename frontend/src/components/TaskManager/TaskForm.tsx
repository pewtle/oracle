import { useState, useEffect, useRef } from 'react';
import type { Task, Profile, TaskCreate } from '@/types';
import { tasksApi } from '@/api/client';

const DAYS = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'S' },
];

type RepeatMode = 'none' | 'daily' | 'weekly';

function buildRecurrenceRule(mode: RepeatMode, days: string[]): string | null {
  if (mode === 'none') return null;
  if (mode === 'daily') return JSON.stringify({ frequency: 'daily' });
  return JSON.stringify({ frequency: 'weekly', days });
}

function parseRecurrenceRule(rule?: string | null): { mode: RepeatMode; days: string[] } {
  if (!rule) return { mode: 'none', days: [] };
  try {
    const parsed = JSON.parse(rule);
    if (parsed.frequency === 'daily') return { mode: 'daily', days: [] };
    if (parsed.frequency === 'weekly') return { mode: 'weekly', days: parsed.days ?? [] };
  } catch {}
  return { mode: 'none', days: [] };
}

interface TaskFormProps {
  task?: Task;
  profiles: Profile[];
  onClose: () => void;
  onSaved: () => void;
}

export default function TaskForm({ task, profiles, onClose, onSaved }: TaskFormProps) {
  const isEditing = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? '');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [profileId, setProfileId] = useState<number>(
    task?.profile_id ?? (profiles[0]?.id ?? 0)
  );
  const [subjectProfileId, setSubjectProfileId] = useState<number | undefined>(
    task?.subject_profile_id
  );

  const initialRecurrence = parseRecurrenceRule(task?.recurrence_rule);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(initialRecurrence.mode);
  const [repeatDays, setRepeatDays] = useState<string[]>(initialRecurrence.days);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function toggleDay(key: string) {
    setRepeatDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!profileId) { setError('Please select a family member.'); return; }
    if (repeatMode === 'weekly' && repeatDays.length === 0) {
      setError('Please select at least one day for weekly repeat.');
      return;
    }

    setSaving(true);
    setError('');

    const payload: TaskCreate = {
      title: title.trim(),
      due_date: dueDate || undefined,
      profile_id: profileId,
      completed: task?.completed ?? false,
      ...(subjectProfileId !== undefined ? { subject_profile_id: subjectProfileId } : {}),
      recurrence_rule: buildRecurrenceRule(repeatMode, repeatDays),
    };

    try {
      if (isEditing && task) {
        await tasksApi.update(task.id, payload);
      } else {
        await tasksApi.create(payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error('Failed to save task:', err);
      setError('Failed to save task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEditing ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="task-title">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="task-title"
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          {/* Repeats */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Repeats
            </label>
            <div className="flex gap-2">
              {(['none', 'daily', 'weekly'] as RepeatMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRepeatMode(m)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    repeatMode === m
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300'
                  }`}
                >
                  {m === 'none' ? 'Never' : m === 'daily' ? 'Daily' : 'Weekly'}
                </button>
              ))}
            </div>

            {repeatMode === 'weekly' && (
              <div className="flex gap-1 mt-2">
                {DAYS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={`flex-1 h-8 rounded text-xs font-semibold transition-colors ${
                      repeatDays.includes(d.key)
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}

            {repeatMode !== 'none' && (
              <p className="text-xs text-slate-400 mt-1.5">
                {repeatMode === 'daily'
                  ? 'This task will reset every day after being completed.'
                  : `Resets on: ${repeatDays.length > 0 ? repeatDays.map(d => d[0].toUpperCase() + d.slice(1)).join(', ') : 'no days selected'}`}
              </p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="task-due-date">
              {repeatMode !== 'none' ? 'First due date' : 'Due Date'}{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Assign To */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="task-profile">
              Assign To <span className="text-red-500">*</span>
            </label>
            <select
              id="task-profile"
              value={profileId}
              onChange={(e) => setProfileId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
              required
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.avatar_emoji} {p.name}</option>
              ))}
            </select>
          </div>

          {/* For (subject profile) */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              For <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              value={subjectProfileId ?? ''}
              onChange={(e) => setSubjectProfileId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              <option value="">— None —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.avatar_emoji} {p.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Use this if the task is about someone else, e.g. "Walk the dog" → For: 🐕 Biscuit
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
