import { useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { parseISO, isValid, startOfWeek } from 'date-fns';
import type { CalendarView as CalendarViewType } from '@/components/Layout/TopBar';
import { useProfiles } from '@/contexts/ProfileContext';
import CalendarView from '@/components/Calendar/CalendarView';

interface CalendarOutletContext {
  calendarView: CalendarViewType;
  calendarDate: Date;
  setCalendarView: (view: CalendarViewType) => void;
  setCalendarDate: (date: Date) => void;
}

const VALID_VIEWS: CalendarViewType[] = ['day', 'week', 'month'];

function isCalendarView(v: string): v is CalendarViewType {
  return VALID_VIEWS.includes(v as CalendarViewType);
}

export default function CalendarPage() {
  const { calendarView, calendarDate, setCalendarView, setCalendarDate } =
    useOutletContext<CalendarOutletContext>();

  const { profiles } = useProfiles();

  const [searchParams, setSearchParams] = useSearchParams();

  // ---------------------------------------------------------------------------
  // Sync URL → state on first load
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const urlView = searchParams.get('view');
    const urlDate = searchParams.get('date');

    if (urlView && isCalendarView(urlView) && urlView !== calendarView) {
      setCalendarView(urlView);
    }

    if (urlDate) {
      const parsed = parseISO(urlDate);
      if (isValid(parsed)) {
        setCalendarDate(parsed);
      }
    }
    // Only run on mount — eslint-disable-next-line exhaustive-deps is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Sync state → URL whenever view or date changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const dateStr = calendarDate.toISOString().split('T')[0];
    const current = {
      view: searchParams.get('view'),
      date: searchParams.get('date'),
    };
    // Only update if something changed to avoid infinite loops
    if (current.view !== calendarView || current.date !== dateStr) {
      setSearchParams({ view: calendarView, date: dateStr }, { replace: true });
    }
  }, [calendarView, calendarDate, searchParams, setSearchParams]);

  // ---------------------------------------------------------------------------
  // Handlers for CalendarView navigation
  // ---------------------------------------------------------------------------
  function handleDateChange(date: Date) {
    setCalendarDate(date);
  }

  function handleViewChange(view: CalendarViewType) {
    // When switching to week view, snap to the start of the week
    if (view === 'week') {
      setCalendarDate(startOfWeek(calendarDate, { weekStartsOn: 1 }));
    }
    setCalendarView(view);
  }

  return (
    <div className="flex flex-col h-full">
      <CalendarView
        view={calendarView}
        currentDate={calendarDate}
        profiles={profiles}
        onDateChange={handleDateChange}
        onViewChange={handleViewChange}
      />
    </div>
  );
}
