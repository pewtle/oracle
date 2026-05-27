import { useCallback, useEffect, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
} from 'date-fns';
import type { CalendarEvent, Profile, Task } from '@/types';
import type { CalendarView as CalendarViewType } from '@/components/Layout/TopBar';
import { api, tasksApi } from '@/api/client';
import DailyView from './DailyView';
import WeeklyView from './WeeklyView';
import MonthlyView from './MonthlyView';
import EventModal from './EventModal';

interface CalendarViewProps {
  view: CalendarViewType;
  currentDate: Date;
  profiles: Profile[];
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarViewType) => void;
}

/**
 * Computes the [start, end] date range to fetch for a given view + date.
 */
function getDateRange(view: CalendarViewType, date: Date): { start: string; end: string } {
  switch (view) {
    case 'day':
      return {
        start: format(date, 'yyyy-MM-dd'),
        end: format(date, 'yyyy-MM-dd'),
      };
    case 'week': {
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      return {
        start: format(date, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
      };
    }
    case 'month': {
      // Extend range to cover the full grid (partial weeks before/after month boundary)
      const gridStart = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
      const gridEnd = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
      return {
        start: format(gridStart, 'yyyy-MM-dd'),
        end: format(gridEnd, 'yyyy-MM-dd'),
      };
    }
  }
}

interface ModalState {
  open: boolean;
  event?: CalendarEvent;
  defaultDate?: Date;
}

export default function CalendarView({
  view,
  currentDate,
  profiles,
  onDateChange,
  onViewChange,
}: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false });

  const fetchEvents = useCallback(async () => {
    const { start, end } = getDateRange(view, currentDate);
    setLoading(true);
    try {
      const { data } = await api.get<CalendarEvent[]>('/events/', {
        params: { start, end },
      });
      setEvents(data);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [view, currentDate]);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await tasksApi.getAll({ completed: false });
      setTasks(data);
    } catch {
      // tasks are supplementary — don't surface errors here
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchTasks();
  }, [fetchEvents, fetchTasks]);

  // Auto-refresh every 60 seconds when the tab is visible (important for wall screen)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchEvents();
        fetchTasks();
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchEvents, fetchTasks]);

  function openAddModal(date?: Date) {
    setModal({ open: true, defaultDate: date ?? currentDate });
  }

  function openEditModal(event: CalendarEvent) {
    setModal({ open: true, event });
  }

  function closeModal() {
    setModal({ open: false });
  }

  function handleSaved() {
    closeModal();
    fetchEvents();
  }

  // For week view: ensure we pass the Monday of the current week as weekStart
  const weekStart =
    view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;

  return (
    <div className="flex flex-col h-full">
      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 px-1">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
          Loading events…
        </div>
      )}

      {/* Calendar body */}
      <div className="flex-1 min-h-0">
        {view === 'day' && (
          <DailyView
            date={currentDate}
            events={events}
            tasks={tasks}
            profiles={profiles}
            onEventClick={openEditModal}
            onAddEvent={(date) => openAddModal(date ?? currentDate)}
          />
        )}
        {view === 'week' && (
          <WeeklyView
            weekStart={weekStart}
            events={events}
            tasks={tasks}
            profiles={profiles}
            onEventClick={openEditModal}
            onAddEvent={(date) => openAddModal(date)}
            onDayClick={(date) => {
              onDateChange(date);
              onViewChange('day');
            }}
          />
        )}
        {view === 'month' && (
          <MonthlyView
            month={currentDate}
            events={events}
            tasks={tasks}
            profiles={profiles}
            onEventClick={openEditModal}
            onDateClick={(date) => {
              onDateChange(date);
              onViewChange('day');
            }}
            onAddEvent={(date) => openAddModal(date)}
          />
        )}
      </div>

      {/* Event create / edit modal */}
      {modal.open && (
        <EventModal
          event={modal.event}
          defaultDate={modal.defaultDate}
          profiles={profiles}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
