import { useState, useEffect, useCallback, useRef } from 'react';
import { routinesApi } from '@/api/client';
import type { RoutineToday, RoutineSlotData, RoutineItem } from '@/types';

// ---------------------------------------------------------------------------
// Particle system — fixed-position emoji that float up on item completion
// ---------------------------------------------------------------------------

interface Particle {
  id: number;
  x: number;
  y: number;
  char: string;
  delay: number;
}

const PARTICLE_CHARS = ['⭐', '✨', '🌟', '💫', '⚡'];

function ParticleLayer({ particles }: { particles: Particle[] }) {
  return (
    <>
      {particles.map(p => (
        <span
          key={p.id}
          className="animate-float-pop fixed text-xl select-none z-[9999]"
          style={{ left: p.x, top: p.y, animationDelay: `${p.delay}ms` }}
        >
          {p.char}
        </span>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Slot config
// ---------------------------------------------------------------------------

type SlotKey = 'morning' | 'evening' | 'bedtime';

const SLOT_CONFIG: Record<SlotKey, {
  emoji: string;
  label: string;
  gradient: string;
  headerText: string;
  dotActive: string;
  checkColor: string;
}> = {
  morning: {
    emoji: '🌅',
    label: 'Morning',
    gradient: 'from-amber-50 to-yellow-50',
    headerText: 'text-amber-800',
    dotActive: 'bg-amber-400',
    checkColor: 'bg-amber-500 border-amber-500',
  },
  evening: {
    emoji: '🌆',
    label: 'Evening',
    gradient: 'from-blue-50 to-indigo-50',
    headerText: 'text-blue-800',
    dotActive: 'bg-blue-400',
    checkColor: 'bg-blue-500 border-blue-500',
  },
  bedtime: {
    emoji: '🌙',
    label: 'Bedtime',
    gradient: 'from-violet-50 to-purple-50',
    headerText: 'text-violet-800',
    dotActive: 'bg-violet-400',
    checkColor: 'bg-violet-500 border-violet-500',
  },
};

// ---------------------------------------------------------------------------
// History dots
// ---------------------------------------------------------------------------

function HistoryDots({ history, dotActive }: { history: boolean[]; dotActive: string }) {
  // history[0] = 6 days ago, history[6] = today
  const today = new Date();
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - 6);

  return (
    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-black/5">
      {history.map((complete, i) => {
        const d = new Date(startDay);
        d.setDate(startDay.getDate() + i);
        const isToday = i === 6;
        const dayLetter = ['M', 'T', 'W', 'T', 'F', 'S', 'S'][d.getDay() === 0 ? 6 : d.getDay() - 1];
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              className={`w-3 h-3 rounded-full transition-colors ${
                complete
                  ? dotActive
                  : 'bg-gray-200'
              } ${isToday ? 'ring-2 ring-offset-1 ring-gray-300' : ''}`}
              title={complete ? 'Completed' : 'Missed'}
            />
            <span className={`text-[9px] font-medium ${isToday ? 'text-gray-700' : 'text-gray-400'}`}>
              {dayLetter}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated checkbox
// ---------------------------------------------------------------------------

function AnimatedCheckbox({
  checked,
  bouncing,
  color,
}: {
  checked: boolean;
  bouncing: boolean;
  color: string;
}) {
  return (
    <div
      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
        checked ? color : 'border-gray-300 bg-white'
      } ${bouncing ? 'animate-bounce-check' : ''}`}
    >
      {checked && (
        <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
          <polyline
            points="1.5,5.5 5.5,9.5 12.5,1.5"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-check-draw"
          />
        </svg>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single routine item row
// ---------------------------------------------------------------------------

function RoutineItemRow({
  item,
  checkColor,
  onToggle,
  onDelete,
  editingId,
  onStartEdit,
  onSaveEdit,
}: {
  item: RoutineItem;
  checkColor: string;
  onToggle: (id: number, e: React.MouseEvent) => void;
  onDelete: (id: number) => void;
  editingId: number | null;
  onStartEdit: (id: number, text: string) => void;
  onSaveEdit: (id: number, text: string) => void;
}) {
  const [bouncing, setBouncing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const isEditing = editingId === item.id;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function handleToggleClick(e: React.MouseEvent) {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 500);
    onToggle(item.id, e);
  }

  return (
    <div
      className={`flex items-center gap-3 py-2.5 px-1 rounded-lg transition-colors group ${
        item.completed_today ? 'opacity-60' : 'hover:bg-black/5'
      }`}
    >
      <button
        onClick={handleToggleClick}
        className="focus:outline-none"
        aria-label={item.completed_today ? 'Mark incomplete' : 'Mark complete'}
      >
        <AnimatedCheckbox
          checked={item.completed_today}
          bouncing={bouncing}
          color={checkColor}
        />
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onBlur={() => onSaveEdit(item.id, editText)}
          onKeyDown={e => {
            if (e.key === 'Enter') onSaveEdit(item.id, editText);
            if (e.key === 'Escape') onSaveEdit(item.id, item.text);
          }}
          className="flex-1 text-sm bg-white border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      ) : (
        <span
          className={`flex-1 text-sm cursor-pointer select-none ${
            item.completed_today ? 'line-through text-gray-400' : 'text-gray-700'
          }`}
          onDoubleClick={() => onStartEdit(item.id, item.text)}
        >
          {item.text}
        </span>
      )}

      <button
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity text-lg leading-none focus:outline-none"
        aria-label="Delete item"
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot card
// ---------------------------------------------------------------------------

function RoutineSlotCard({
  slotData,
  onToggle,
  onAdd,
  onDelete,
  onEdit,
  glowing,
}: {
  slotData: RoutineSlotData;
  onToggle: (itemId: number, e: React.MouseEvent) => void;
  onAdd: (routineId: number, text: string) => void;
  onDelete: (itemId: number) => void;
  onEdit: (itemId: number, text: string) => void;
  glowing: boolean;
}) {
  const cfg = SLOT_CONFIG[slotData.slot as SlotKey];
  const [newItemText, setNewItemText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAddItem(e?: React.FormEvent) {
    e?.preventDefault();
    const text = newItemText.trim();
    if (!text) return;
    setNewItemText('');
    onAdd(slotData.routine_id, text);
  }

  function handleSaveEdit(itemId: number, text: string) {
    setEditingId(null);
    onEdit(itemId, text);
  }

  const completedCount = slotData.items.filter(i => i.completed_today).length;
  const totalCount = slotData.items.length;

  return (
    <div
      className={`bg-gradient-to-br ${cfg.gradient} rounded-2xl border border-white/80 shadow-sm p-5 flex flex-col gap-1 transition-shadow ${
        glowing ? 'animate-slot-glow' : ''
      } ${slotData.slot_complete ? 'ring-2 ring-green-300/50' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{cfg.emoji}</span>
          <div>
            <h3 className={`font-bold text-lg leading-tight ${cfg.headerText}`}>{cfg.label}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {completedCount}/{totalCount} done
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {slotData.slot_complete && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
              ✓ Done!
            </span>
          )}
          {slotData.streak.current_streak > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
              🔥 {slotData.streak.current_streak}
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex flex-col">
        {slotData.items.map(item => (
          <RoutineItemRow
            key={item.id}
            item={item}
            checkColor={cfg.checkColor}
            onToggle={onToggle}
            onDelete={onDelete}
            editingId={editingId}
            onStartEdit={(id, _text) => { setEditingId(id); }}
            onSaveEdit={handleSaveEdit}
          />
        ))}
      </div>

      {/* Add item */}
      <form onSubmit={handleAddItem} className="flex items-center gap-2 mt-1">
        <input
          ref={inputRef}
          value={newItemText}
          onChange={e => setNewItemText(e.target.value)}
          placeholder="+ Add item…"
          className="flex-1 text-sm bg-white/60 rounded-lg px-3 py-1.5 border border-transparent focus:border-gray-300 focus:bg-white focus:outline-none placeholder:text-gray-400 transition-colors"
        />
        {newItemText.trim() && (
          <button
            type="submit"
            className="text-xs px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Add
          </button>
        )}
      </form>

      {/* 7-day history dots */}
      <HistoryDots history={slotData.history} dotActive={cfg.dotActive} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Perfect day banner
// ---------------------------------------------------------------------------

function PerfectDayBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="animate-perfect-day flex items-center justify-between bg-gradient-to-r from-yellow-100 via-green-100 to-blue-100 border border-green-200 rounded-2xl px-6 py-4 shadow-md">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🏆</span>
        <div>
          <p className="font-bold text-gray-800 text-lg">Perfect Day!</p>
          <p className="text-sm text-gray-600">All routines complete — amazing work!</p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 text-xl ml-4 leading-none"
      >
        ✕
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time-based greeting
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning! 🌅';
  if (h < 17) return 'Good afternoon! ☀️';
  if (h < 21) return 'Good evening! 🌆';
  return 'Good night! 🌙';
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RoutinesPage() {
  const [data, setData] = useState<RoutineToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [glowingSlot, setGlowingSlot] = useState<string | null>(null);
  const [showPerfectDay, setShowPerfectDay] = useState(false);
  const prevPerfectDay = useRef(false);

  const load = useCallback(async () => {
    try {
      const result = await routinesApi.getToday();
      setData(result);
      if (result.perfect_day && !prevPerfectDay.current) {
        setShowPerfectDay(true);
      }
      prevPerfectDay.current = result.perfect_day;
    } catch {
      setError('Failed to load routines. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function spawnParticles(x: number, y: number) {
    const newP: Particle[] = PARTICLE_CHARS.map((char, i) => ({
      id: Date.now() + i,
      x: x + (i - 2) * 14,
      y: y - 10,
      char,
      delay: i * 60,
    }));
    setParticles(p => [...p, ...newP]);
    setTimeout(() => {
      setParticles(p => p.filter(pp => !newP.find(np => np.id === pp.id)));
    }, 1400);
  }

  async function handleToggle(itemId: number, e: React.MouseEvent) {
    if (!data) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    // Optimistic update
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        slots: prev.slots.map(slot => ({
          ...slot,
          items: slot.items.map(item =>
            item.id === itemId
              ? { ...item, completed_today: !item.completed_today }
              : item
          ),
          slot_complete: slot.items.every(item =>
            item.id === itemId
              ? !item.completed_today
              : item.completed_today
          ),
        })),
      };
    });

    try {
      const result = await routinesApi.toggleItem(itemId);

      if (result.completed) {
        spawnParticles(rect.left + rect.width / 2, rect.top);
      }

      // If slot just completed, trigger glow
      if (result.slot_complete) {
        const slot = data.slots.find(s => s.items.some(i => i.id === itemId));
        if (slot) {
          setGlowingSlot(slot.slot);
          setTimeout(() => setGlowingSlot(null), 1000);
        }
      }

      // Re-fetch to sync streaks, history, perfect_day
      const fresh = await routinesApi.getToday();
      setData(fresh);
      if (fresh.perfect_day && !prevPerfectDay.current) {
        setShowPerfectDay(true);
      }
      prevPerfectDay.current = fresh.perfect_day;
    } catch {
      setError('Failed to update. Please try again.');
      load(); // revert optimistic update
    }
  }

  async function handleAddItem(routineId: number, text: string) {
    try {
      await routinesApi.addItem(routineId, { text });
      load();
    } catch {
      setError('Failed to add item.');
    }
  }

  async function handleDeleteItem(itemId: number) {
    // Optimistic remove
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        slots: prev.slots.map(slot => ({
          ...slot,
          items: slot.items.filter(item => item.id !== itemId),
        })),
      };
    });
    try {
      await routinesApi.deleteItem(itemId);
    } catch {
      setError('Failed to delete item.');
      load();
    }
  }

  async function handleEditItem(itemId: number, text: string) {
    try {
      await routinesApi.updateItem(itemId, { text });
      load();
    } catch {
      setError('Failed to update item.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm animate-pulse">
        Loading routines…
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <ParticleLayer particles={particles} />

      {/* Greeting + title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Routines</h1>
        <p className="text-slate-500 text-sm mt-0.5">{getGreeting()}</p>
      </div>

      {/* Perfect day banner */}
      {showPerfectDay && (
        <PerfectDayBanner onDismiss={() => setShowPerfectDay(false)} />
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Three slot cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.slots.map(slot => (
            <RoutineSlotCard
              key={slot.slot}
              slotData={slot}
              onToggle={handleToggle}
              onAdd={handleAddItem}
              onDelete={handleDeleteItem}
              onEdit={handleEditItem}
              glowing={glowingSlot === slot.slot}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <p className="text-xs text-gray-400 text-center">
        Double-click any item to edit it · 🔥 = current streak · dots = last 7 days
      </p>
    </div>
  );
}
