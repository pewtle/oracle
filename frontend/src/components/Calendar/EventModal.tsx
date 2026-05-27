import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent, CalendarEventCreate, Profile } from '@/types';
import { eventsApi } from '@/api/client';

interface EventModalProps {
  event?: CalendarEvent;
  defaultDate?: Date;
  profiles: Profile[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  title: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  profileIds: number[];
  colourOverride: string;
  recurrenceFrequency: 'none' | 'daily' | 'weekly' | 'weekly-custom';
  recurrenceWeekdays: string[];
}

function parseRecurrenceRule(rule: string | null | undefined): {
  frequency: 'none' | 'daily' | 'weekly' | 'weekly-custom';
  weekdays: string[];
} {
  if (!rule) return { frequency: 'none', weekdays: [] };
  try {
    const parsed = JSON.parse(rule) as { frequency: string; days?: string[] };
    const days = parsed.days ?? [];
    if (parsed.frequency === 'daily') return { frequency: 'daily', weekdays: [] };
    if (parsed.frequency === 'weekly') {
      // If exactly one day and it matches a single weekday, treat as 'weekly';
      // if multiple days, treat as 'weekly-custom'
      if (days.length === 1) return { frequency: 'weekly', weekdays: days };
      return { frequency: 'weekly-custom', weekdays: days };
    }
  } catch {
    // ignore malformed rule
  }
  return { frequency: 'none', weekdays: [] };
}

function buildInitialState(event?: CalendarEvent, defaultDate?: Date): FormState {
  if (event) {
    const recurrenceRule = event.recurrence_rule;
    const { frequency, weekdays } = parseRecurrenceRule(recurrenceRule);
    return {
      title: event.title,
      date: event.date,
      allDay: event.all_day,
      startTime: event.start_time ? event.start_time.slice(0, 5) : '',
      endTime: event.end_time ? event.end_time.slice(0, 5) : '',
      profileIds: event.profiles.map((p) => p.id),
      colourOverride: event.colour_override ?? '',
      recurrenceFrequency: frequency,
      recurrenceWeekdays: weekdays,
    };
  }
  // Pre-fill start/end time when a specific grid slot was clicked
  let startTime = '';
  let endTime = '';
  if (defaultDate) {
    const h = defaultDate.getHours();
    const m = defaultDate.getMinutes();
    if (h > 0 || m > 0) {
      startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const endTotal = h * 60 + m + 60;
      endTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
    }
  }
  return {
    title: '',
    date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    allDay: false,
    startTime,
    endTime,
    profileIds: [],
    colourOverride: '',
    recurrenceFrequency: 'none',
    recurrenceWeekdays: [],
  };
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function EventModal({ event, defaultDate, profiles, onClose, onSaved }: EventModalProps) {
  const isEdit = !!event;
  const [form, setForm] = useState<FormState>(() => buildInitialState(event, defaultDate));
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showColourOverride, setShowColourOverride] = useState(false);

  // Focus title input on mount
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleProfile(id: number) {
    setForm((prev) => ({
      ...prev,
      profileIds: prev.profileIds.includes(id)
        ? prev.profileIds.filter((pid) => pid !== id)
        : [...prev.profileIds, id],
    }));
  }

  function toggleWeekday(day: string) {
    setForm((prev) => ({
      ...prev,
      recurrenceWeekdays: prev.recurrenceWeekdays.includes(day)
        ? prev.recurrenceWeekdays.filter((d) => d !== day)
        : [...prev.recurrenceWeekdays, day],
    }));
  }

  function buildRecurrenceRule(): string | null {
    if (form.recurrenceFrequency === 'none') return null;
    if (form.recurrenceFrequency === 'daily') {
      return JSON.stringify({ frequency: 'daily', days: [] });
    }
    if (form.recurrenceFrequency === 'weekly') {
      const dayIndex = new Date(form.date).getDay();
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      return JSON.stringify({ frequency: 'weekly', days: [dayNames[dayIndex]] });
    }
    // weekly-custom
    return JSON.stringify({ frequency: 'weekly', days: form.recurrenceWeekdays });
  }

  function buildPayload(): CalendarEventCreate {
    return {
      title: form.title.trim(),
      date: form.date,
      all_day: form.allDay,
      start_time: form.allDay || !form.startTime ? undefined : `${form.startTime}:00`,
      end_time: form.allDay || !form.endTime ? undefined : `${form.endTime}:00`,
      profile_ids: form.profileIds,
      colour_override: form.colourOverride || undefined,
      source: 'local',
      recurrence_rule: buildRecurrenceRule(),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && event) {
        await eventsApi.update(event.id, buildPayload());
      } else {
        await eventsApi.create(buildPayload());
      }
      onSaved();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    setDeleting(true);
    try {
      await eventsApi.remove(event.id);
      onSaved();
    } catch {
      setError('Failed to delete. Please try again.');
      setDeleting(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal panel */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Edit Event' : 'Add Event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form — fills remaining height and scrolls */}
        <form
          id="event-modal-form"
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Scrollable fields area */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="evt-title">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                ref={titleRef}
                id="evt-title"
                type="text"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="Event title"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="evt-date">
                Date
              </label>
              <input
                id="evt-date"
                type="date"
                value={form.date}
                onChange={(e) => setField('date', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            {/* All Day toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.allDay}
                onClick={() => setField('allDay', !form.allDay)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                  form.allDay ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    form.allDay ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">All day</span>
            </div>

            {/* Start / End time — only when not all-day */}
            {!form.allDay && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="evt-start">
                    Start time
                  </label>
                  <input
                    id="evt-start"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setField('startTime', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="evt-end">
                    End time
                  </label>
                  <input
                    id="evt-end"
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setField('endTime', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Repeats */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="evt-recurrence">
                Repeats
              </label>
              <select
                id="evt-recurrence"
                value={form.recurrenceFrequency}
                onChange={(e) =>
                  setField('recurrenceFrequency', e.target.value as FormState['recurrenceFrequency'])
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="weekly-custom">Custom days</option>
              </select>

              {form.recurrenceFrequency === 'weekly-custom' && (
                <div className="flex gap-1 flex-wrap mt-2">
                  {WEEKDAY_LABELS.map((day) => {
                    const key = day.toLowerCase();
                    const active = form.recurrenceWeekdays.includes(key);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(key)}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${
                          active
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Assign members */}
            {profiles.length > 0 && (
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">Assign members</p>
                <div className="space-y-2">
                  {profiles.map((profile) => {
                    const checked = form.profileIds.includes(profile.id);
                    return (
                      <label
                        key={profile.id}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProfile(profile.id)}
                          className="sr-only"
                        />
                        {/* Custom checkbox */}
                        <span
                          className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                            checked ? 'border-primary-600 bg-primary-600' : 'border-gray-300 bg-white'
                          }`}
                        >
                          {checked && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        {/* Profile colour swatch */}
                        <span
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: profile.colour }}
                        />
                        <span className="text-sm text-gray-800">
                          {profile.avatar_emoji} {profile.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Colour override — collapsed behind Advanced toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowColourOverride((v) => !v)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${showColourOverride ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Advanced
              </button>

              {showColourOverride && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="evt-colour">
                    Colour override{' '}
                    <span className="text-xs text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="evt-colour"
                      type="color"
                      value={form.colourOverride || '#6366f1'}
                      onChange={(e) => setField('colourOverride', e.target.value)}
                      className="h-9 w-14 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={form.colourOverride}
                      onChange={(e) => setField('colourOverride', e.target.value)}
                      placeholder="#6366f1"
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {form.colourOverride && (
                      <button
                        type="button"
                        onClick={() => setField('colourOverride', '')}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer — always visible at bottom of modal */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0 gap-3">
            {isEdit ? (
              !confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600">Delete this event?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors disabled:opacity-60"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="px-3 py-1 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60"
              >
                {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add Event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
