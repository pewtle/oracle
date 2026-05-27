import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format, isSameDay, isSameMonth } from 'date-fns';
import type { CalendarEvent, Profile, Task } from '@/types';
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
      <div className="px-1.5 py-1 h-full overflow-hidden">
        <p className="text-[11px] font-bold leading-tight truncate">
          {event.title}
          {event.source === 'google' && (
            <span className="opacity-60 ml-0.5 text-[10px]">🔁</span>
          )}
        </p>
        {height >= 36 && event.start_time && (
          <p className="text-[10px] leading-tight opacity-80 mt-0.5">
            {formatTime(event.start_time)}
            {event.end_time && ` – ${formatTime(event.end_time)}`}
          </p>
        )}
        {height >= 52 && event.profiles.length > 0 && (
          <p className="text-xs leading-tight mt-0.5">
            {event.profiles.slice(0, 3).map((p) => p.avatar_emoji).join('')}
          </p>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CurrentTimeIndicator (weekly — only rendered in the today column)
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
      className="w-full text-left flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium truncate hover:opacity-75 transition-opacity"
      style={{
        backgroundColor: overdue ? '#fef2f2' : `${colour}18`,
        color: overdue ? '#dc2626' : colour,
        border: `1px dashed ${overdue ? '#fca5a5' : colour}`,
      }}
      title={task.title}
    >
      <span className="flex-shrink-0">☐</span>
      {task.profile?.avatar_emoji && (
        <span className="flex-shrink-0">{task.profile.avatar_emoji}</span>
      )}
      <span className="truncate">{task.title}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// WeeklyView
// ---------------------------------------------------------------------------

interface WeeklyViewProps {
  weekStart: Date;
  events: CalendarEvent[];
  tasks: Task[];
  profiles: Profile[];
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date) => void;
  onDayClick?: (date: Date) => void;
}

export default function WeeklyView({
  weekStart,
  events,
  tasks,
  profiles: _profiles,
  onEventClick,
  onAddEvent,
  onDayClick,
}: WeeklyViewProps) {
  const navigate = useNavigate();
  const today = new Date();
  const days: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current time if today is in view, else 8 am
  useEffect(() => {
    if (!scrollRef.current) return;
    const hasToday = days.some((d) => isSameDay(d, today));
    const scrollHour = hasToday
      ? Math.max(today.getHours() - 1, START_HOUR)
      : 8;
    scrollRef.current.scrollTop = (scrollHour - START_HOUR) * HOUR_HEIGHT;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // Show the all-day/tasks strip if any day has all-day events OR due tasks
  const hasAnyAllDay = days.some((day) => {
    const ds = format(day, 'yyyy-MM-dd');
    return events.some((e) => e.date === ds && e.all_day)
      || tasks.some((t) => t.due_date === ds);
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Fixed header row */}
      <div className="flex flex-shrink-0 border-b border-gray-200 bg-white">
        {/* Gutter spacer to align with time-label column */}
        <div className="flex-shrink-0 w-14" />
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          const isCurrentMonth = isSameMonth(day, weekStart);
          return (
            <div key={format(day, 'yyyy-MM-dd')} className="flex-1 min-w-0">
              <div
                className={`flex items-center justify-between py-2 px-1.5 ${
                  isToday ? 'bg-blue-50' : ''
                }`}
              >
                <button
                  onClick={() => onDayClick?.(day)}
                  className="flex flex-col items-center flex-1 hover:bg-gray-50 rounded-md transition-colors py-0.5"
                >
                  <span
                    className={`text-xs font-medium uppercase tracking-wider ${
                      isToday
                        ? 'text-primary-600'
                        : isCurrentMonth
                        ? 'text-gray-500'
                        : 'text-gray-300'
                    }`}
                  >
                    {format(day, 'EEE')}
                  </span>
                  <span
                    className={`mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${
                      isToday
                        ? 'bg-primary-600 text-white'
                        : isCurrentMonth
                        ? 'text-gray-800'
                        : 'text-gray-400'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </button>
                <button
                  onClick={() => onAddEvent(day)}
                  className="text-sm w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors opacity-60 hover:opacity-100 flex-shrink-0"
                  aria-label={`Add event on ${format(day, 'MMM d')}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day strip — only when at least one all-day event exists */}
      {hasAnyAllDay && (
        <div className="flex flex-shrink-0 border-b border-gray-100 bg-white py-1">
          <div className="flex-shrink-0 w-14 flex items-center justify-end pr-2">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">All day</span>
          </div>
          {days.map((day) => {
            const ds = format(day, 'yyyy-MM-dd');
            const allDayEvents = events.filter((e) => e.date === ds && e.all_day);
            const dueTasks = tasks.filter((t) => t.due_date === ds);
            return (
              <div key={ds} className="flex-1 min-w-0 px-0.5 space-y-0.5 py-0.5">
                {allDayEvents.map((event) => {
                  const colour = getEventColour(event);
                  return (
                    <div
                      key={event.id}
                      className="rounded border border-dashed px-1.5 py-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ borderColor: colour, backgroundColor: `${colour}18` }}
                      onClick={() => onEventClick(event)}
                    >
                      <span className="text-[10px] font-medium truncate block" style={{ color: colour }}>
                        {event.title}
                      </span>
                    </div>
                  );
                })}
                {dueTasks.map((task) => (
                  <TaskChip
                    key={task.id}
                    task={task}
                    onClick={() => navigate('/tasks')}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex" style={{ height: GRID_HEIGHT }}>
          {/* Time labels */}
          <div className="flex-shrink-0 w-14 relative select-none">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-gray-400 leading-none"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 7 }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const ds = format(day, 'yyyy-MM-dd');
            const isToday = isSameDay(day, today);
            const dayEvents = events.filter((e) => e.date === ds);
            const positioned = layoutDayEvents(dayEvents);

            function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
              if (e.target !== e.currentTarget) return;
              const rawMins = (e.nativeEvent.offsetY / HOUR_HEIGHT) * 60;
              const snapped = Math.round(rawMins / 30) * 30 + START_HOUR * 60;
              const clickedDate = new Date(day);
              clickedDate.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);
              onAddEvent(clickedDate);
            }

            return (
              <div
                key={ds}
                className={`flex-1 min-w-0 relative border-l border-gray-100 cursor-pointer ${
                  isToday ? 'bg-blue-50/30' : ''
                }`}
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
                    style={{
                      top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                    }}
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
