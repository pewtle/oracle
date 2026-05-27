import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';

export type CalendarView = 'day' | 'week' | 'month';

interface TopBarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

function getDisplayLabel(view: CalendarView, date: Date): string {
  switch (view) {
    case 'day':
      return format(date, 'EEEE, MMMM d, yyyy');
    case 'week': {
      const weekStart = date;
      const weekEnd = addDays(date, 6);
      if (format(weekStart, 'MMMM') === format(weekEnd, 'MMMM')) {
        return `${format(weekStart, 'MMMM d')} – ${format(weekEnd, 'd, yyyy')}`;
      }
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    case 'month':
      return format(date, 'MMMM yyyy');
  }
}

function navigate(view: CalendarView, date: Date, direction: 1 | -1): Date {
  switch (view) {
    case 'day':   return direction === 1 ? addDays(date, 1)    : subDays(date, 1);
    case 'week':  return direction === 1 ? addWeeks(date, 1)   : subWeeks(date, 1);
    case 'month': return direction === 1 ? addMonths(date, 1)  : subMonths(date, 1);
  }
}

const views: CalendarView[] = ['day', 'week', 'month'];

export default function TopBar({ view, onViewChange, currentDate, onDateChange }: TopBarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-100 shadow-sm">
      {/* Date navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onDateChange(navigate(view, currentDate, -1))}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Previous"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-base font-semibold text-slate-800 min-w-[200px] text-center">
          {getDisplayLabel(view, currentDate)}
        </span>

        <button
          onClick={() => onDateChange(navigate(view, currentDate, 1))}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Next"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={() => { onDateChange(new Date()); onViewChange('day'); }}
          className="ml-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          Today
        </button>
      </div>

      {/* View toggle */}
      <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              view === v
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
