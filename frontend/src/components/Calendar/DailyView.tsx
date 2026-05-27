import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import type { CalendarEvent, Profile, Task } from '@/types';
import EventPill from './EventPill';
import { getEventColour } from './EventPill';

// ---------------------------------------------------------------------------
// Constants & utilities
// ---------------------------------------------------------------------------

const HOUR_HEIGHT = 64; // px per hour
const START_HOUR = 6;   // 6 am
const END_HOUR = 23;    // 11 pm
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT; // 1088px
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + parseInt(m || '0', 10);
}

function formatHour(h: number): string {
  if (h === 12) return '12 pm';
  if (h === 0) return '12 am';
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const display = h % 12 || 12;
  return `${display}:${String(m).padStart(2, '0')}${period}`;
}

function textOnColour(hex: string): string {
  if (!hex || hex.length < 7) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#1e293b' : '#ffffff';
}

// ---------------------------------------------------------------------------
// Layout algorithm
// ---------------------------------------------------------------------------

interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  col: number;
  totalCols: number;
}

function layoutDayEvents(events: CalendarEvent[]): PositionedEvent[] {
  const timed = events
    .filter((e) => !e.all_day && e.start_time)
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));

  if (timed.length === 0) return [];

  const colEnds: number[] = [];
  const assignments: { event: CalendarEvent; col: number; endMins: number }[] = [];

  for (const event of timed) {
    const startMins = timeToMinutes(event.start_time!);
    const endMins = event.end_time ? timeToMinutes(event.end_time) : startMins + 60;

    let col = -1;
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= startMins) {
        col = c;
        colEnds[c] = endMins;
        break;
      }
    }
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(endMins);
    }
    assignments.push({ event, col, endMins });
  }

  return assignments.map(({ event, col, endMins }) => {
    const startMins = timeToMinutes(event.start_time!);
    let maxCol = col;
    for (const { event: o, col: oc, endMins: oe } of assignments) {
      if (o === event) continue;
      const os = timeToMinutes(o.start_time!);
      if (os < endMins && oe > startMins) maxCol = Math.max(maxCol, oc);
    }
    const clampStart = Math.max(startMins, START_HOUR * 60);
    const clampEnd = Math.min(endMins, END_HOUR * 60);
    return {
      event,
      top: ((clampStart - START_HOUR * 60) / 60) * HOUR_HEIGHT,
      height: Math.max(((clampEnd - clampStart) / 60) * HOUR_HEIGHT, 20),
      col,
      totalCols: maxCol + 1,
    };
  });
}

// ---------------------------------------------------------------------------
// EventBlock
// ---------------------------------------------------------------------------

function EventBlock({
  event,
  top,
  height,
  col,
  totalCols,
  colour,
  onClick,
}: {
  event: CalendarEvent;
  top: number;
  height: number;
  col: number;
  totalCols: number;
  colour: string;
  onClick: () => void;
}) {
  const fg = textOnColour(colour);
  const GAP = 2;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute rounded-md overflow-hidden hover:brightness-95 active:brightness-90 transition-all text-left shadow-sm"
      style={{
        top: top + 1,
        height: height - 2,
        left: `calc(${(col / totalCols) * 100}% + ${GAP}px)`,
        width: `calc(${(1 / totalCols) * 100}% - ${GAP * 2}px)`,
        backgroundColor: colour,
        color: fg,
        zIndex: 10,
      }}
    >
      <div className="px-2 py-1 h-full overflow-hidden">
        <p className="text-xs font-bold leading-tight truncate">
          {event.title}
          {event.source === 'google' && (
            <span className="opacity-60 ml-0.5 text-[10px]">🔁</span>
          )}
        </p>
        {height >= 36 && event.start_time && (
          <p className="text-xs leading-tight opacity-80 mt-0.5">
            {formatTime(event.start_time)}
            {event.end_time && ` – ${formatTime(event.end_time)}`}
          </p>
        )}
        {height >= 52 && event.profiles.length > 0 && (
          <p className="text-sm leading-tight mt-0.5">
            {event.profiles.slice(0, 3).map((p) => p.avatar_emoji).join('')}
          </p>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CurrentTimeIndicator
// ---------------------------------------------------------------------------

function CurrentTimeIndicator() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < START_HOUR * 60 || mins > END_HOUR * 60) return null;
  const top = ((mins - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
      style={{ top }}
    >
      <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0 -ml-1.5" />
      <div className="flex-1 h-0.5 bg-red-500" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskChip — compact chip for a due task, visually distinct from events
// ---------------------------------------------------------------------------

function TaskChip({ task, onClick }: { task: Task; onClick: () => void }) {
  const colour = task.profile?.colour ?? '#94a3b8';
  const overdue = task.is_overdue;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-full text-left flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium truncate hover:opacity-75 transition-opacity"
      style={{
        backgroundColor: overdue ? '#fef2f2' : `${colour}18`,
        color: overdue ? '#dc2626' : colour,
        border: `1px dashed ${overdue ? '#fca5a5' : colour}`,
      }}
      title={task.title}
    >
      <span className="flex-shrink-0 text-[10px]">☐</span>
      {task.profile?.avatar_emoji && (
        <span className="flex-shrink-0">{task.profile.avatar_emoji}</span>
      )}
      <span className="truncate">{task.title}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// DailyView
// ---------------------------------------------------------------------------

interface DailyViewProps {
  date: Date;
  events: CalendarEvent[];
  tasks: Task[];
  profiles: Profile[];
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date?: Date) => void;
}

export default function DailyView({
  date,
  events,
  tasks,
  profiles,
  onEventClick,
  onAddEvent,
}: DailyViewProps) {
  const navigate = useNavigate();
  const dateStr = format(date, 'yyyy-MM-dd');
  const isToday = isSameDay(date, new Date());

  const dayEvents = events.filter((e) => e.date === dateStr);
  const allDayEvents = dayEvents.filter((e) => e.all_day);
  const dueTasks = tasks.filter((t) => t.due_date === dateStr);
  const positioned = layoutDayEvents(dayEvents);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current time (today) or 8 am (other days)
  useEffect(() => {
    if (!scrollRef.current) return;
    const scrollHour = isToday
      ? Math.max(new Date().getHours() - 1, START_HOUR)
      : 8;
    const scrollTop = ((scrollHour - START_HOUR) / 1) * HOUR_HEIGHT;
    scrollRef.current.scrollTop = scrollTop;
  }, [isToday]);

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const rawMins = (e.nativeEvent.offsetY / HOUR_HEIGHT) * 60;
    const snapped = Math.round(rawMins / 30) * 30 + START_HOUR * 60;
    const clickedDate = new Date(date);
    clickedDate.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);
    onAddEvent(clickedDate);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h2 className={`text-xl font-bold ${isToday ? 'text-primary-600' : 'text-gray-800'}`}>
            {format(date, 'EEEE')}
          </h2>
          <p className="text-sm text-gray-500">{format(date, 'MMMM d, yyyy')}</p>
        </div>
        <button
          onClick={() => onAddEvent(date)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </button>
      </div>

      {/* All-day + tasks strip */}
      {(allDayEvents.length > 0 || dueTasks.length > 0) && (
        <div className="mb-3 flex-shrink-0 space-y-2">
          {allDayEvents.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5">All Day</p>
              <div className="space-y-1.5">
                {allDayEvents.map((event) => (
                  <EventPill
                    key={event.id}
                    event={event}
                    profiles={profiles}
                    onClick={() => onEventClick(event)}
                    size="md"
                  />
                ))}
              </div>
            </div>
          )}
          {dueTasks.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5">Due Today</p>
              <div className="space-y-1">
                {dueTasks.map((task) => (
                  <TaskChip
                    key={task.id}
                    task={task}
                    onClick={() => navigate('/tasks')}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex" style={{ minHeight: GRID_HEIGHT + HOUR_HEIGHT }}>
          {/* Time labels column */}
          <div className="flex-shrink-0 w-14 relative select-none">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-xs text-gray-400 leading-none"
                style={{ top: ((h - START_HOUR) * HOUR_HEIGHT) - 7 }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Grid + events */}
          <div
            className="flex-1 relative cursor-pointer"
            style={{ height: GRID_HEIGHT }}
            onClick={handleGridClick}
          >
            {/* Hour lines */}
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-gray-100"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
              />
            ))}
            {/* Half-hour lines */}
            {HOURS.slice(0, -1).map((h) => (
              <div
                key={`${h}-half`}
                className="absolute left-0 right-0 border-t border-gray-50"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
              />
            ))}

            {/* Current time indicator */}
            {isToday && <CurrentTimeIndicator />}

            {/* Positioned events */}
            {positioned.map(({ event, top, height, col, totalCols }) => (
              <EventBlock
                key={event.id}
                event={event}
                top={top}
                height={height}
                col={col}
                totalCols={totalCols}
                colour={getEventColour(event)}
                onClick={() => onEventClick(event)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
