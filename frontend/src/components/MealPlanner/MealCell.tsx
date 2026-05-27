import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { MealPlan, Recipe } from '@/types';

type MealType = 'breakfast' | 'lunch' | 'dinner';

interface MealCellProps {
  meal?: MealPlan;
  date: string;
  mealType: MealType;
  recipes: Recipe[];
  onSave: (description: string) => void;
  onDelete: () => void;
}

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
};

export default function MealCell({ meal, mealType, recipes, onSave, onDelete }: MealCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(meal?.description ?? '');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [mode, setMode] = useState<'recipe' | 'custom'>('recipe');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setInputValue(meal?.description ?? '');
  }, [meal, isEditing]);

  useEffect(() => {
    if (isEditing) {
      if (mode === 'custom') {
        inputRef.current?.focus();
        inputRef.current?.select();
      } else {
        searchRef.current?.focus();
      }
    }
  }, [isEditing, mode]);

  function handleStartEdit() {
    setInputValue(meal?.description ?? '');
    setRecipeSearch('');
    // Default to recipe picker if there are recipes, otherwise custom
    setMode(recipes.length > 0 ? 'recipe' : 'custom');
    setIsEditing(true);
  }

  function handleSave() {
    const trimmed = inputValue.trim();
    if (trimmed) onSave(trimmed);
    setIsEditing(false);
  }

  function handleCancel() {
    setInputValue(meal?.description ?? '');
    setIsEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') handleCancel();
  }

  function handleSelectRecipe(recipe: Recipe) {
    setInputValue(recipe.title);
    setIsEditing(false);
    onSave(recipe.title);
  }

  const icon = MEAL_ICONS[mealType];

  const filteredRecipes = recipeSearch.trim()
    ? recipes.filter(r =>
        r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
        r.description?.toLowerCase().includes(recipeSearch.toLowerCase())
      )
    : recipes;

  // ------------------------------------------------------------------
  // Editing state
  // ------------------------------------------------------------------
  if (isEditing) {
    return (
      <div className="relative min-h-[100px] xl:min-h-[130px] p-2 border border-primary-300 rounded-lg bg-white flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs select-none">{icon}</span>
          {/* Mode tabs — only show if there are recipes */}
          {recipes.length > 0 && (
            <div className="flex gap-0.5 text-[10px] font-medium">
              <button
                type="button"
                onClick={() => setMode('recipe')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  mode === 'recipe'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                📖 Recipe
              </button>
              <button
                type="button"
                onClick={() => { setMode('custom'); setTimeout(() => inputRef.current?.focus(), 0); }}
                className={`px-2 py-0.5 rounded transition-colors ${
                  mode === 'custom'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                ✏️ Custom
              </button>
            </div>
          )}
        </div>

        {mode === 'recipe' ? (
          /* ---- Recipe picker ---- */
          <div className="flex flex-col gap-1 flex-1">
            <input
              ref={searchRef}
              type="text"
              value={recipeSearch}
              onChange={e => setRecipeSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') handleCancel(); }}
              placeholder="Search recipes…"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
            <div className="flex-1 overflow-y-auto max-h-[120px] space-y-0.5">
              {filteredRecipes.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-2">
                  {recipes.length === 0 ? 'No recipes yet — add some in the Recipes tab' : 'No matches'}
                </p>
              ) : (
                filteredRecipes.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRecipe(r)}
                    className="w-full text-left px-2 py-1 rounded text-xs hover:bg-primary-50 hover:text-primary-700 transition-colors truncate"
                  >
                    {r.title}
                    {r.servings && (
                      <span className="text-gray-400 ml-1">· serves {r.servings}</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-gray-400 hover:text-gray-600 mt-auto text-center"
            >
              Cancel
            </button>
          </div>
        ) : (
          /* ---- Custom text ---- */
          <>
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
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="text-sm px-3 py-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>
          </>
        )}

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
  // Filled state
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
