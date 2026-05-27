import { useEffect, useRef, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameDay,
  isSameMonth,
} from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent, Profile, Task } from '@/types';
import EventPill from './EventPill';

interface MonthlyViewProps {
  month: Date;
  events: CalendarEvent[];
  tasks: Task[];
  profiles: Profile[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  onAddEvent: (date: Date) => void;
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_VISIBLE_EVENTS = 3;

export default function MonthlyView({
  month,
  events,
  tasks,
  profiles,
  onEventClick,
  onDateClick,
  onAddEvent,
}: MonthlyViewProps) {
  const navigate = useNavigate();
  const today = new Date();

  // Build grid: from start of the week containing the first day of the month
  // to end of the week containing the last day of the month
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });

  const cells: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    cells.push(cursor);
    cursor = addDays(cursor, 1);
  }

  // Track which cell's overflow popover is open (by dateStr)
  const [popoverCell, setPopoverCell] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!popoverCell) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverCell(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popoverCell]);

  return (
    <div className="flex flex-col h-full">
      {/* Weekday header row */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAY_HEADERS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr border-l border-t border-gray-100">
        {cells.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const isToday = isSameDay(day, today);
          const isCurrentMonth = isSameMonth(day, month);
          const isPopoverOpen = popoverCell === dayStr;

          const dayEvents = events
            .filter((e) => e.date === dayStr)
            .sort((a, b) => {
              // All-day first, then by start_time
              if (a.all_day && !b.all_day) return -1;
              if (!a.all_day && b.all_day) return 1;
              const aTime = a.start_time ?? '';
              const bTime = b.start_time ?? '';
              return aTime.localeCompare(bTime);
            });

          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS;
          const dueTasks = tasks.filter((t) => t.due_date === dayStr);
          const overdueCount = dueTasks.filter((t) => t.is_overdue).length;

          return (
            <div
              key={dayStr}
              className={`border-r border-b border-gray-100 p-1 min-h-[80px] flex flex-col relative group ${
                isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              {/* Day number row + add button */}
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => onAddEvent(day)}
                  className="w-5 h-5 rounded-full text-gray-300 hover:text-primary-500 hover:bg-primary-50 text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Add event on ${format(day, 'MMM d')}`}
                >
                  +
                </button>
                <button
                  onClick={() => onDateClick(day)}
                  className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold transition-colors hover:bg-gray-100 ${
                    isToday
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : isCurrentMonth
                      ? 'text-gray-800'
                      : 'text-gray-400'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              </div>

              {/* Events */}
              <div className="space-y-0.5 flex-1">
                {visibleEvents.map((event) => (
                  <div key={event.id} className="min-h-[28px]">
                    <EventPill
                      event={event}
                      profiles={profiles}
                      onClick={() => onEventClick(event)}
                      size="sm"
                    />
                  </div>
                ))}

                {/* Due tasks indicator */}
                {dueTasks.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate('/tasks'); }}
                    className={`w-full text-left text-[10px] font-medium px-1 py-0.5 rounded truncate transition-colors ${
                      overdueCount > 0
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    ☐ {dueTasks.length} task{dueTasks.length !== 1 ? 's' : ''}{overdueCount > 0 ? ` (${overdueCount} overdue)` : ''}
                  </button>
                )}

                {/* Overflow link — opens floating popover */}
                {overflowCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopoverCell(isPopoverOpen ? null : dayStr);
                    }}
                    className="w-full text-left text-xs text-primary-600 hover:text-primary-700 font-medium px-1 py-0.5 transition-colors"
                  >
                    +{overflowCount} more
                  </button>
                )}
              </div>

              {/* Floating popover showing all events for this day */}
              {isPopoverOpen && (
                <div
                  ref={popoverRef}
                  className="absolute z-20 top-0 left-full ml-1 w-56 bg-white rounded-lg shadow-xl border border-gray-100 p-2 space-y-1"
                  style={{ minWidth: '14rem' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-700">
                      {format(day, 'EEEE, MMM d')}
                    </span>
                    <button
                      onClick={() => setPopoverCell(null)}
                      className="text-gray-400 hover:text-gray-600 text-xs leading-none p-0.5"
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>
                  {dayEvents.map((event) => (
                    <div key={event.id} className="min-h-[28px]">
                      <EventPill
                        event={event}
                        profiles={profiles}
                        onClick={() => {
                          setPopoverCell(null);
                          onEventClick(event);
                        }}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
