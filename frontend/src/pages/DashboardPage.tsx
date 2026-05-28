import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, routinesApi } from '@/api/client';
import { useProfiles } from '@/contexts/ProfileContext';
import type { CalendarEvent, MealPlan, Task, RoutineToday, RoutineSlotData } from '@/types';

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
// Routines strip — time-aware progress summary
// ---------------------------------------------------------------------------

type RoutineSlotKey = 'morning' | 'evening' | 'bedtime';

const SLOT_THEME: Record<RoutineSlotKey, {
  emoji: string;
  label: string;
  trackColor: string;
  arcColor: string;
  bg: string;
  labelColor: string;
}> = {
  morning: {
    emoji: '🌅',
    label: 'Morning',
    trackColor: '#fef3c7',
    arcColor: '#f59e0b',
    bg: 'bg-amber-50',
    labelColor: 'text-amber-800',
  },
  evening: {
    emoji: '🌆',
    label: 'Evening',
    trackColor: '#dbeafe',
    arcColor: '#3b82f6',
    bg: 'bg-blue-50',
    labelColor: 'text-blue-800',
  },
  bedtime: {
    emoji: '🌙',
    label: 'Bedtime',
    trackColor: '#ede9fe',
    arcColor: '#8b5cf6',
    bg: 'bg-violet-50',
    labelColor: 'text-violet-800',
  },
};

function getRelevantSlots(hour: number): RoutineSlotKey[] {
  if (hour < 12) return ['morning'];
  if (hour < 19) return ['morning', 'evening'];
  return ['evening', 'bedtime'];
}

function ProgressRing({
  value,
  max,
  arcColor,
  trackColor,
  size = 72,
  stroke = 7,
}: {
  value: number;
  max: number;
  arcColor: string;
  trackColor: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circ * (1 - pct);
  const complete = max > 0 && value >= max;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={trackColor} strokeWidth={stroke} />
        {/* Arc */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={complete ? '#22c55e' : arcColor}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
      </svg>
      {/* Centre label */}
      <div className="absolute inset-0 flex items-center justify-center">
        {complete ? (
          <span className="text-green-500 text-xl leading-none">✓</span>
        ) : (
          <span className="text-xs font-bold text-gray-600 leading-none">
            {max === 0 ? '—' : `${value}/${max}`}
          </span>
        )}
      </div>
    </div>
  );
}

function SlotTile({ slot }: { slot: RoutineSlotData }) {
  const theme = SLOT_THEME[slot.slot as RoutineSlotKey];
  const completed = slot.items.filter((i) => i.completed_today).length;
  const total = slot.items.length;
  // Next incomplete item name
  const nextItem = slot.items.find((i) => !i.completed_today);

  return (
    <Link
      to="/routines"
      className={`flex items-center gap-4 ${theme.bg} rounded-xl px-4 py-3 hover:opacity-90 transition-opacity`}
    >
      <ProgressRing
        value={completed}
        max={total}
        arcColor={theme.arcColor}
        trackColor={theme.trackColor}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-base leading-none">{theme.emoji}</span>
          <span className={`font-semibold text-sm ${theme.labelColor}`}>{theme.label}</span>
          {slot.streak.current_streak > 0 && (
            <span className="text-xs font-medium text-orange-500">
              🔥 {slot.streak.current_streak}
            </span>
          )}
        </div>
        {total === 0 ? (
          <p className="text-xs text-gray-400">No items added</p>
        ) : slot.slot_complete ? (
          <p className="text-xs font-semibold text-green-600">All done! 🎉</p>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              {completed} of {total} complete
            </p>
            {nextItem && (
              <p className="text-xs text-gray-400 truncate mt-0.5">
                Next: {nextItem.text}
              </p>
            )}
          </>
        )}
      </div>
    </Link>
  );
}

function RoutinesStrip() {
  const [data, setData] = useState<RoutineToday | null>(null);
  const [loading, setLoading] = useState(true);
  const hour = new Date().getHours();
  const slotsToShow = getRelevantSlots(hour);

  useEffect(() => {
    routinesApi.getToday()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const relevantSlots = slotsToShow
    .map((name) => data?.slots.find((s) => s.slot === name))
    .filter((s): s is RoutineSlotData => Boolean(s));

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-700">Routines</h2>
        <Link
          to="/routines"
          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
        >
          View all →
        </Link>
      </div>

      {loading ? (
        <SkeletonLines count={2} />
      ) : (
        <div className={`grid gap-3 ${relevantSlots.length === 1 ? 'grid-cols-1 max-w-sm' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {relevantSlots.map((slot) => (
            <SlotTile key={slot.slot} slot={slot} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Weather widget — Open-Meteo, no API key, Macclesfield UK
// ---------------------------------------------------------------------------

const WMO: Record<number, { emoji: string; label: string }> = {
  0:  { emoji: '☀️',  label: 'Clear sky'        },
  1:  { emoji: '🌤️', label: 'Mainly clear'      },
  2:  { emoji: '⛅',  label: 'Partly cloudy'     },
  3:  { emoji: '☁️',  label: 'Overcast'          },
  45: { emoji: '🌫️', label: 'Fog'               },
  48: { emoji: '🌫️', label: 'Icy fog'           },
  51: { emoji: '🌦️', label: 'Light drizzle'     },
  53: { emoji: '🌦️', label: 'Drizzle'           },
  55: { emoji: '🌧️', label: 'Heavy drizzle'     },
  61: { emoji: '🌧️', label: 'Light rain'        },
  63: { emoji: '🌧️', label: 'Rain'              },
  65: { emoji: '🌧️', label: 'Heavy rain'        },
  71: { emoji: '❄️',  label: 'Light snow'        },
  73: { emoji: '❄️',  label: 'Snow'              },
  75: { emoji: '❄️',  label: 'Heavy snow'        },
  77: { emoji: '❄️',  label: 'Snow grains'       },
  80: { emoji: '🌦️', label: 'Light showers'     },
  81: { emoji: '🌧️', label: 'Showers'           },
  82: { emoji: '⛈️',  label: 'Heavy showers'     },
  85: { emoji: '🌨️', label: 'Snow showers'      },
  86: { emoji: '🌨️', label: 'Heavy snow showers'},
  95: { emoji: '⛈️',  label: 'Thunderstorm'      },
  96: { emoji: '⛈️',  label: 'Thunderstorm'      },
  99: { emoji: '⛈️',  label: 'Thunderstorm'      },
};

interface WeatherData {
  temp: number;
  feelsLike: number;
  windspeed: number;
  code: number;
}

function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(
      'https://api.open-meteo.com/v1/forecast' +
      '?latitude=53.2588&longitude=-2.1248' +
      '&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m' +
      '&timezone=Europe%2FLondon'
    )
      .then(r => r.json())
      .then(d => {
        const c = d.current;
        setWeather({
          temp: c.temperature_2m,
          feelsLike: c.apparent_temperature,
          windspeed: c.windspeed_10m,
          code: c.weathercode,
        });
      })
      .catch(() => setError(true));
  }, []);

  if (error || !weather) return null;

  const wmo = WMO[weather.code] ?? { emoji: '🌡️', label: 'Unknown' };

  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex-shrink-0">
      <span className="text-4xl leading-none">{wmo.emoji}</span>
      <div>
        <p className="text-2xl font-bold text-slate-800 leading-none">
          {Math.round(weather.temp)}°C
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{wmo.label}</p>
        <p className="text-xs text-slate-400">
          Feels {Math.round(weather.feelsLike)}°C · {weather.windspeed} km/h · Macclesfield
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card 3 — Tasks
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
      <h2 className="text-lg font-semibold text-slate-700 mb-4">Tasks</h2>

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
                  <span>{completedCount}/{totalCount} tasks done</span>
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

      <Link
        to="/chores"
        className="mt-5 block text-center text-xl font-bold text-white bg-amber-400 hover:bg-amber-500 rounded-xl py-5 transition-colors shadow-md"
      >
        ⭐ My Tasks
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
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl xl:text-4xl font-bold text-slate-800">
            {dayName}, {dayDate}
          </h1>
          <p className="text-slate-400 text-sm mt-1">Good {timeOfDay}</p>
        </div>
        <WeatherWidget />
      </div>

      {/* Three-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 xl:text-base mb-4">
        <EventsCard />
        <MealsCard />
        <ChoresCard />
      </div>

      {/* Routines summary — below the main cards */}
      <RoutinesStrip />
    </div>
  );
}
