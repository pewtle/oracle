import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { MealPlan } from '@/types';

type MealType = 'breakfast' | 'lunch' | 'dinner';

interface MealCellProps {
  meal?: MealPlan;
  date: string;
  mealType: MealType;
  onSave: (description: string) => void;
  onDelete: () => void;
}

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
};

export default function MealCell({ meal, mealType, onSave, onDelete }: MealCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(meal?.description ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep local input in sync if the meal prop changes (e.g. after a refetch)
  useEffect(() => {
    if (!isEditing) {
      setInputValue(meal?.description ?? '');
    }
  }, [meal, isEditing]);

  // Auto-focus the input whenever we enter edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  function handleStartEdit() {
    setInputValue(meal?.description ?? '');
    setIsEditing(true);
  }

  function handleSave() {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onSave(trimmed);
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setInputValue(meal?.description ?? '');
    setIsEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }

  const icon = MEAL_ICONS[mealType];

  // ------------------------------------------------------------------
  // Editing state
  // ------------------------------------------------------------------
  if (isEditing) {
    return (
      <div className="relative min-h-[100px] xl:min-h-[130px] p-2 border border-primary-300 rounded-lg bg-white flex flex-col gap-1">
        <span className="text-xs select-none">{icon}</span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's for this meal?"
          className="w-full border-0 focus:ring-0 text-sm p-1 bg-transparent outline-none text-gray-800 placeholder-gray-400 flex-1"
        />
        <div className="flex items-center gap-1 justify-end mt-auto">
          <button
            onClick={handleSave}
            className="text-sm px-3 py-1.5 rounded bg-primary-500 text-white hover:bg-primary-600 transition-colors"
            title="Save (Enter)"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="text-sm px-3 py-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            title="Cancel (Escape)"
          >
            ✕
          </button>
        </div>
        {meal && (
          <button
            type="button"
            onClick={() => { onDelete(); setIsEditing(false); }}
            className="text-xs text-red-400 hover:text-red-600 mt-1 w-full text-center"
          >
            Remove meal
          </button>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Filled state (meal exists)
  // ------------------------------------------------------------------
  if (meal) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleStartEdit}
        onKeyDown={e => e.key === 'Enter' && handleStartEdit()}
        className="relative min-h-[100px] xl:min-h-[130px] p-2 border border-gray-200 rounded-lg bg-white text-gray-800 cursor-pointer hover:border-primary-300 hover:bg-primary-50/40 transition-colors group"
      >
        <div className="flex items-start justify-between gap-1">
          <span className="text-xs select-none flex-shrink-0">{icon}</span>
          <span className="text-xs text-gray-300 group-hover:text-gray-500 absolute top-1 right-1">✏️</span>
        </div>
        <p className="text-sm mt-1 leading-snug break-words">{meal.description}</p>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Empty state
  // ------------------------------------------------------------------
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleStartEdit}
      onKeyDown={e => e.key === 'Enter' && handleStartEdit()}
      className="relative min-h-[100px] xl:min-h-[130px] p-2 border border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-400 cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors flex flex-col items-center justify-center gap-1"
    >
      <span className="text-base select-none">{icon}</span>
      <span className="text-sm">+ Add meal</span>
    </div>
  );
}
