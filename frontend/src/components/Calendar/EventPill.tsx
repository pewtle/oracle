import type { CalendarEvent, Profile } from '@/types';

interface EventPillProps {
  event: CalendarEvent;
  profiles: Profile[];
  onClick: () => void;
  size?: 'sm' | 'md';
}

/**
 * Resolves the display colour for an event.
 * - Uses colour_override when set
 * - Uses the first assigned profile's colour when available
 * - Falls back to a neutral slate colour
 */
export function getEventColour(event: CalendarEvent): string {
  if (event.colour_override) return event.colour_override;
  if (event.profiles.length > 0) return event.profiles[0].colour;
  return '#94a3b8'; // slate-400
}

/**
 * Formats a time string "HH:MM:SS" → "H:MM am/pm"
 */
function formatTime(timeStr: string): string {
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const min = minStr;
  const period = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${min}${period}`;
}

export default function EventPill({ event, profiles: _profiles, onClick, size = 'sm' }: EventPillProps) {
  const colour = getEventColour(event);

  // Collect emojis for assigned profiles (up to 2)
  const assignedEmojis = event.profiles.slice(0, 2).map((p) => p.avatar_emoji);

  const timeLabel =
    !event.all_day && event.start_time ? formatTime(event.start_time) : null;

  if (size === 'md') {
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-white rounded-md shadow-sm border border-gray-100 border-l-[6px] px-3 py-2 hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-offset-1"
        style={{ borderLeftColor: colour, focusRingColor: colour } as React.CSSProperties}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800 truncate">
            {event.title}
            {event.source === 'google' && (
              <span className="text-[10px] opacity-60 ml-0.5" title="Synced from Google Calendar">🔁</span>
            )}
          </span>
          {assignedEmojis.length > 0 && (
            <span className="flex-shrink-0 text-base leading-none">
              {assignedEmojis.join('')}
            </span>
          )}
        </div>
        {timeLabel && (
          <p className="text-xs text-gray-500 mt-0.5">{timeLabel}</p>
        )}
      </button>
    );
  }

  // size === 'sm'
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-md border border-gray-100 border-l-[6px] px-2 py-1.5 text-sm hover:shadow-sm transition-shadow focus:outline-none truncate flex items-center gap-1"
      style={{ borderLeftColor: colour } as React.CSSProperties}
    >
      {timeLabel && (
        <span className="flex-shrink-0 text-xs text-gray-400">{timeLabel}</span>
      )}
      <span className="truncate text-gray-800 font-medium">{event.title}</span>
      {event.source === 'google' && (
        <span className="text-[10px] opacity-60 ml-0.5" title="Synced from Google Calendar">🔁</span>
      )}
      {assignedEmojis.length > 0 && (
        <span className="flex-shrink-0 text-xs leading-none ml-auto">{assignedEmojis[0]}</span>
      )}
    </button>
  );
}
