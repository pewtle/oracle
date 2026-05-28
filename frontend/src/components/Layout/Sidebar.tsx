import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useProfiles } from '@/contexts/ProfileContext';
import { api } from '@/api/client';
import type { MealPlan } from '@/types';

// ---------------------------------------------------------------------------
// Simple inline SVG icons to avoid an icon library dependency at this stage
// ---------------------------------------------------------------------------
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const TasksIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const MealsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const ListsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Sun/house logo icon
// ---------------------------------------------------------------------------
const OdysseusLogo = () => (
  <svg className="w-7 h-7 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const RecipesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const RoutinesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const navLinks = [
  { to: '/',          label: 'Today',    icon: <HomeIcon />     },
  { to: '/calendar',  label: 'Calendar', icon: <CalendarIcon /> },
  { to: '/routines',  label: 'Routines', icon: <RoutinesIcon /> },
  { to: '/meals',     label: 'Meals',    icon: <MealsIcon />    },
  { to: '/recipes',   label: 'Recipes',  icon: <RecipesIcon />  },
  { to: '/lists',     label: 'Lists',    icon: <ListsIcon />    },
  { to: '/tasks',     label: 'Tasks',    icon: <TasksIcon />    },
];

// ---------------------------------------------------------------------------
// Tonight's Dinner widget
// ---------------------------------------------------------------------------
function TonightsDinner() {
  const [dinner, setDinner] = useState<MealPlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    api
      .get<MealPlan[]>('/meals/', { params: { start: today, end: today } })
      .then((res) => {
        const found = res.data.find((m) => m.meal_type === 'dinner') ?? null;
        setDinner(found);
      })
      .catch(() => {
        setDinner(null);
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  if (!loaded) return null;

  return (
    <div className="px-4 py-2">
      {dinner ? (
        <p className="flex items-center gap-1 min-w-0">
          <span>🌙</span>
          <span className="text-xs text-slate-300 truncate">{dinner.description}</span>
        </p>
      ) : (
        <p className="flex items-center gap-1">
          <span>🌙</span>
          <span className="text-xs text-slate-500 italic">No dinner planned</span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
export default function Sidebar() {
  const { profiles } = useProfiles();

  return (
    <aside className="flex flex-col h-full bg-sidebar text-white w-full">
      {/* Logo / app title */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <OdysseusLogo />
        <span className="text-xl font-semibold tracking-tight text-white">Odysseus</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navLinks.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            {icon}
            <span className="text-sm font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Family member avatars */}
      {profiles.length > 0 && (
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider font-medium">Family</p>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 transition-all"
                style={{ backgroundColor: profile.colour }}
                title={profile.name}
              >
                {profile.avatar_emoji}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tonight's dinner widget */}
      <TonightsDinner />

      {/* Settings link — small, muted, at the very bottom */}
      <div className="px-3 pb-4">
        <NavLink
          to="/settings"
          end
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          <SettingsIcon />
          <span className="text-xs text-slate-400">Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
