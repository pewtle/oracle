import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, listsApi } from '@/api/client';
import type { MealPlan, MealPlanCreate } from '@/types';
import MealCell from './MealCell';

type MealType = 'breakfast' | 'lunch' | 'dinner';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '☀️ Lunch',
  dinner: '🌙 Dinner',
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Return the Monday of the week that contains `d`. */
function getMonday(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Format a Date as "YYYY-MM-DD". */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a Date as "26 May". */
function formatDayDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Format a Date as "Mon". */
function formatDayName(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

/** Add `n` days to `d`, returning a new Date. */
function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

/** True if two dates fall on the same calendar day. */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MEAL_TYPE_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, dinner: 2 };

export default function WeeklyMealPlanner() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  // Build the 7 day columns for the current week
  const days: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const today = new Date();

  // ------------------------------------------------------------------
  // Fetch meals for the displayed week
  // ------------------------------------------------------------------
  const fetchMeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const end = addDays(weekStart, 6);
      const response = await api.get<MealPlan[]>('/meals/', {
        params: {
          start: toISODate(weekStart),
          end: toISODate(end),
        },
      });
      setMeals(response.data);
    } catch {
      setError('Failed to load meals. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  // ------------------------------------------------------------------
  // Lookup helper: find the meal for a specific day + type
  // ------------------------------------------------------------------
  function getMeal(date: Date, mealType: MealType): MealPlan | undefined {
    const dateStr = toISODate(date);
    return meals.find(m => m.date === dateStr && m.meal_type === mealType);
  }

  // ------------------------------------------------------------------
  // Save handler (upsert)
  // ------------------------------------------------------------------
  async function handleSave(date: Date, mealType: MealType, description: string) {
    const payload: MealPlanCreate = {
      date: toISODate(date),
      meal_type: mealType,
      description,
    };
    try {
      await api.post<MealPlan>('/meals/', payload);
      await fetchMeals();
    } catch {
      setError('Failed to save meal. Please try again.');
    }
  }

  // ------------------------------------------------------------------
  // Delete handler
  // ------------------------------------------------------------------
  async function handleDelete(meal: MealPlan) {
    try {
      await api.delete(`/meals/${meal.id}`);
      await fetchMeals();
    } catch {
      setError('Failed to delete meal. Please try again.');
    }
  }

  // ------------------------------------------------------------------
  // Export meals to a new shopping list
  // ------------------------------------------------------------------
  async function handleExportToList() {
    if (meals.length === 0) {
      setError('No meals planned this week to export.');
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const listName = `Meals — ${formatDayDate(weekStart)} to ${formatDayDate(addDays(weekStart, 6))}`;
      const newList = await listsApi.create({ name: listName, colour: '#10b981' });

      // Sort meals: by date, then breakfast → lunch → dinner
      const sorted = [...meals].sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return MEAL_TYPE_ORDER[a.meal_type as MealType] - MEAL_TYPE_ORDER[b.meal_type as MealType];
      });

      // Add each meal as a list item: "Mon · Breakfast — Porridge"
      await Promise.all(
        sorted.map((meal, i) => {
          const day = new Date(meal.date + 'T00:00:00');
          const dayLabel = day.toLocaleDateString('en-GB', { weekday: 'short' });
          const typeLabel = meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1);
          const text = `${dayLabel} · ${typeLabel} — ${meal.description}`;
          return listsApi.addItem(newList.id, { text, checked: false, position: i });
        })
      );

      // Auto-select the new list when navigating to /lists
      localStorage.setItem('odysseus-last-list-id', String(newList.id));

      setExportDone(true);
      setTimeout(() => {
        setExportDone(false);
        navigate('/lists');
      }, 800);
    } catch {
      setError('Failed to create shopping list. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------
  function goToPrevWeek() {
    setWeekStart(prev => addDays(prev, -7));
  }

  function goToNextWeek() {
    setWeekStart(prev => addDays(prev, 7));
  }

  function goToThisWeek() {
    setWeekStart(getMonday(new Date()));
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Navigation bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevWeek}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
            aria-label="Previous week"
          >
            <ChevronLeftIcon />
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
            aria-label="Next week"
          >
            <ChevronRightIcon />
          </button>
          <span className="text-sm xl:text-lg font-semibold text-gray-700 min-w-[160px]">
            {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' – '}
            {weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToThisWeek}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
          >
            This Week
          </button>
          <button
            onClick={handleExportToList}
            disabled={exporting || exportDone || meals.length === 0}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors font-medium ${
              exportDone
                ? 'bg-green-50 border-green-300 text-green-700'
                : meals.length === 0
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
            }`}
            title={meals.length === 0 ? 'No meals planned this week' : 'Create a shopping list from this week\'s meals'}
          >
            {exportDone ? '✓ Added!' : exporting ? 'Creating…' : (
              <>
                <CartIcon />
                Shopping list
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="text-center py-6 text-sm text-gray-400 animate-pulse">
          Loading meals…
        </div>
      )}

      {/* Grid — hidden while loading to avoid flash */}
      {!loading && (
        <div className="overflow-x-auto -mx-1">
          {/*
            Grid layout:
              Column 0  : row labels (auto width)
              Columns 1–7 : one per day (equal width, min 90px each)
          */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'auto repeat(7, minmax(90px, 1fr))',
            }}
          >
            {/* ---- Header row ---- */}
            {/* Top-left corner cell */}
            <div className="p-2" aria-hidden="true" />

            {/* Day column headers */}
            {days.map(day => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={toISODate(day)}
                  className={`p-2 text-center rounded-t-lg ${
                    isToday
                      ? 'bg-primary-50 text-primary-700 font-semibold'
                      : 'text-gray-600'
                  }`}
                >
                  <div className="text-xs xl:text-sm font-medium uppercase tracking-wide">
                    {formatDayName(day)}
                  </div>
                  <div className={`text-sm xl:text-base mt-0.5 ${isToday ? 'font-bold' : ''}`}>
                    {formatDayDate(day)}
                  </div>
                </div>
              );
            })}

            {/* ---- Meal type rows ---- */}
            {MEAL_TYPES.map(mealType => (
              <>
                {/* Row label */}
                <div
                  key={`label-${mealType}`}
                  className="flex items-center justify-end pr-3 py-2 text-gray-500 text-sm xl:text-base font-medium whitespace-nowrap"
                >
                  {MEAL_LABELS[mealType]}
                </div>

                {/* Meal cells — one per day */}
                {days.map(day => {
                  const meal = getMeal(day, mealType);
                  return (
                    <div key={`${toISODate(day)}-${mealType}`} className="p-1">
                      <MealCell
                        meal={meal}
                        date={toISODate(day)}
                        mealType={mealType}
                        onSave={description => handleSave(day, mealType, description)}
                        onDelete={() => meal && handleDelete(meal)}
                      />
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function CartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.98-1.67L23 6H6" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
