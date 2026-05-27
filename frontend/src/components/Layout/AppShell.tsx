import { useState, useCallback } from 'react';
import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar, { type CalendarView } from './TopBar';
import { useIdleTimer } from '@/hooks/useIdleTimer';

// TopBar is only shown on the Calendar page
const TOPBAR_ROUTES = ['/calendar'];

// 5 minutes idle → screensaver
const IDLE_DELAY_MS = 5 * 60 * 1000;

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const showTopBar = TOPBAR_ROUTES.includes(location.pathname);

  const [calendarView, setCalendarView] = useState<CalendarView>('day');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  const handleIdle = useCallback(() => {
    navigate('/screensaver');
  }, [navigate]);

  useIdleTimer(handleIdle, IDLE_DELAY_MS);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex md:w-[220px] md:flex-shrink-0 md:flex-col h-full">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {showTopBar && (
          <TopBar
            view={calendarView}
            onViewChange={setCalendarView}
            currentDate={calendarDate}
            onDateChange={setCalendarDate}
          />
        )}

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ calendarView, calendarDate, setCalendarView, setCalendarDate }} />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile bottom nav
// ---------------------------------------------------------------------------
const mobileNavItems = [
  { to: '/',         label: 'Today',    emoji: '🏠' },
  { to: '/chores',   label: 'Chores',   emoji: '⭐' },
  { to: '/calendar', label: 'Calendar', emoji: '📅' },
  { to: '/tasks',    label: 'Tasks',    emoji: '✅' },
  { to: '/recipes',  label: 'Recipes',  emoji: '🍳' },
];

function MobileBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
      <div className="flex justify-around py-2">
        {mobileNavItems.map(({ to, label, emoji }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                isActive ? 'text-primary-600' : 'text-slate-500'
              }`
            }
          >
            <span className="text-lg leading-none">{emoji}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
