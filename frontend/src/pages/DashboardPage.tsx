import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useProfiles } from '@/contexts/ProfileContext';
import type { CalendarEvent, MealPlan, Task } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatHeaderDate(): { dayName: string; dayDate: string } {
  const now = new Date();
  const dayName = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const dayDate = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return { dayName, dayDate };
}

function formatEventTime(event: CalendarEvent): string {
  if (event.all_day || !event.start_time) return 'All day';
  // start_time is "HH:MM:SS"
  const [h, m] = event.start_time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m}${ampm}`;
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-4 bg-slate-100 rounded" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card 1 — Today's Events
// ---------------------------------------------------------------------------
function EventsCard() {
  const { profiles } = useProfiles();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const today = toISODate(new Date());

  useEffect(() => {
    api
      .get<CalendarEvent[]>('/events/', { params: { start: today, end: today } })
      .then((res) => {
        // Sort: all-day first, then timed by start_time
        const sorted = [...res.data].sort((a, b) => {
          if (a.all_day && !b.all_day) return -1;
          if (!a.all_day && b.all_day) return 1;
          if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
          return 0;
        });
        setEvents(sorted);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  // Get a colour for an event — use the first assigned profile's colour, or a default
  function eventColour(event: CalendarEvent): string {
    if (event.colour_override) return event.colour_override;
    if (event.profiles.length > 0) return event.profiles[0].colour;
    if (profiles.length > 0) return profiles[0].colour;
    return '#6366f1';
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-700 mb-4">Today's Events</h2>

      {loading ? (
        <SkeletonLines count={3} />
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-2">
          <span className="text-3xl">📅</span>
          <span className="text-sm">Nothing scheduled today</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.slice(0, 5).map((event) => (
            <li key={event.id} className="flex items-start gap-3">
              <div
                className="w-1 rounded-full self-stretch flex-shrink-0 mt-0.5"
                style={{ backgroundColor: eventColour(event), minHeight: '1.25rem' }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{event.title}</p>
                <p className="text-xs text-slate-400">{formatEventTime(event)}</p>
              </div>
              {event.profiles.length > 0 && (
                <div className="flex gap-0.5 flex-shrink-0">
                  {event.profiles.map((p) => (
                    <span key={p.id} title={p.name} className="text-sm leading-none">
                      {p.avatar_emoji}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => navigate(`/calendar?date=${today}&openAdd=true`)}
        className="mt-5 w-full text-sm text-primary-600 font-medium border border-primary-200 rounded-lg py-2 hover:bg-primary-50 transition-colors"
      >
        + Add Event
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 2 — Today's Meals
// ---------------------------------------------------------------------------
function MealsCard() {
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const today = toISODate(new Date());

  useEffect(() => {
    api
      .get<MealPlan[]>('/meals/', { params: { start: today, end: today } })
      .then((res) => setMeals(res.data))
      .catch(() => setMeals([]))
      .finally(() => setLoading(false));
  }, []);

  type MealSlot = { type: 'breakfast' | 'lunch' | 'dinner'; emoji: string; label: string };
  const slots: MealSlot[] = [
    { type: 'breakfast', emoji: '🌅', label: 'Breakfast' },
    { type: 'lunch',     emoji: '☀️', label: 'Lunch'     },
    { type: 'dinner',    emoji: '🌙', label: 'Dinner'    },
  ];

  function getMeal(type: MealSlot['type']): string | null {
    return meals.find((m) => m.meal_type === type)?.description ?? null;
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-700 mb-4">Today's Meals</h2>

      {loading ? (
        <SkeletonLines count={3} />
      ) : (
        <ul className="space-y-3">
          {slots.map(({ type, emoji, label }) => {
            const desc = getMeal(type);
            const isDinner = type === 'dinner';
            return (
              <li key={type} className="flex items-start gap-3">
                <span className="text-base flex-shrink-0">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-medium uppercase tracking-wide text-slate-400`}>
                    {label}
                  </span>
                  <p
                    className={`truncate ${
                      isDinner
                        ? 'text-sm font-semibold text-slate-800'
                        : 'text-sm text-slate-600'
                    } ${!desc ? 'text-slate-400 italic' : ''}`}
                  >
                    {desc ?? '—'}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        to="/meals"
        className="mt-5 block text-center text-sm text-primary-600 font-medium border border-primary-200 rounded-lg py-2 hover:bg-primary-50 transition-colors"
      >
        Plan meals
      </Link>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card 3 — Chores
// ---------------------------------------------------------------------------
function ChoresCard() {
  const { profiles } = useProfiles();
  const [incompleteTasks, setIncompleteTasks] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Task[]>('/tasks/', { params: { completed: false } }),
      api.get<Task[]>('/tasks/'),
    ])
      .then(([incompleteRes, allRes]) => {
        // Sort incomplete by due_date (nulls last)
        const sorted = [...incompleteRes.data].sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        });
        setIncompleteTasks(sorted);
        setTotalCount(allRes.data.length);
      })
      .catch(() => {
        setIncompleteTasks([]);
        setTotalCount(0);
      })
      .finally(() => setLoading(false));
  }, []);

  const completedCount = totalCount - incompleteTasks.length;
  const allDone = totalCount > 0 && incompleteTasks.length === 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function profileEmoji(task: Task): string {
    if (task.profile) return task.profile.avatar_emoji;
    const p = profiles.find((pr) => pr.id === task.profile_id);
    return p?.avatar_emoji ?? '👤';
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-700 mb-4">Chores</h2>

      {loading ? (
        <SkeletonLines count={3} />
      ) : (
        <>
          {allDone ? (
            <div className="flex flex-col items-center justify-center py-4 gap-2">
              <span className="text-3xl">🎉</span>
              <span className="text-sm font-semibold text-green-600">All done!</span>
            </div>
          ) : (
            <>
              {/* Progress summary */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{completedCount}/{totalCount} chores done</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Incomplete task list */}
              <ul className="space-y-2 mt-3">
                {incompleteTasks.slice(0, 4).map((task) => (
                  <li key={task.id} className="flex items-center gap-2">
                    <span className="text-sm flex-shrink-0">{profileEmoji(task)}</span>
                    <span className="text-sm text-slate-700 truncate flex-1">{task.title}</span>
                    {task.due_date && (
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {/* Launch Chore Screen — prominent full-width button */}
      <Link
        to="/chores"
        className="mt-5 block text-center text-xl font-bold text-white bg-amber-400 hover:bg-amber-500 rounded-xl py-5 transition-colors shadow-md"
      >
        ⭐ My Chores
      </Link>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const { dayName, dayDate } = formatHeaderDate();
  const timeOfDay = getTimeOfDay();

  return (
    <div className="min-h-screen bg-surface p-6 xl:p-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl xl:text-4xl font-bold text-slate-800">
          {dayName}, {dayDate}
        </h1>
        <p className="text-slate-400 text-sm mt-1">Good {timeOfDay}</p>
      </div>

      {/* Three-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xl:text-base">
        <EventsCard />
        <MealsCard />
        <ChoresCard />
      </div>
    </div>
  );
}
