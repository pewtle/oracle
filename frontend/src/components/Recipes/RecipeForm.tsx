import { useState, useEffect, useRef } from 'react';
import type { Recipe, RecipeCreate } from '@/types';
import { recipesApi } from '@/api/client';

// ---------------------------------------------------------------------------
// TheMealDB — free public API, no key required, CORS-enabled
// ---------------------------------------------------------------------------

interface MealDBMeal {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  [key: string]: string | null;
}

interface MealDBResponse {
  meals: MealDBMeal[] | null;
}

async function searchMealDB(query: string): Promise<MealDBMeal[]> {
  const res = await fetch(
    `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new Error('API error');
  const data: MealDBResponse = await res.json();
  return data.meals ?? [];
}

function extractIngredients(meal: MealDBMeal): string[] {
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = meal[`strIngredient${i}`]?.trim();
    const measure = meal[`strMeasure${i}`]?.trim();
    if (ingredient) {
      ingredients.push(measure ? `${measure} ${ingredient}` : ingredient);
    }
  }
  return ingredients;
}

// ---------------------------------------------------------------------------
// Online search panel
// ---------------------------------------------------------------------------

interface SearchPanelProps {
  onSelect: (meal: MealDBMeal) => void;
  onCollapse: () => void;
}

function SearchPanel({ onSelect, onCollapse }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MealDBMeal[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const meals = await searchMealDB(query);
        setResults(meals);
        setSearched(true);
      } catch {
        setError("Couldn't reach the recipe database. Check your internet connection.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 380);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-blue-800 flex items-center gap-1.5">
          <SearchIcon />
          Search online for a recipe
        </p>
        <button
          type="button"
          onClick={onCollapse}
          className="text-blue-400 hover:text-blue-600 text-xs"
        >
          Enter manually ↓
        </button>
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. Spaghetti Bolognese, Chicken Tikka…"
          className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-8"
        />
        {searching && (
          <span className="absolute right-2.5 top-2.5 text-blue-400 text-xs animate-pulse">⟳</span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {searched && !searching && results.length === 0 && (
        <p className="text-xs text-blue-500 text-center py-2">No recipes found for "{query}"</p>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
          {results.map(meal => (
            <button
              key={meal.idMeal}
              type="button"
              onClick={() => onSelect(meal)}
              className="w-full flex items-center gap-3 bg-white rounded-lg border border-blue-100 px-3 py-2 hover:border-blue-300 hover:bg-blue-50 text-left transition-colors group"
            >
              {meal.strMealThumb && (
                <img
                  src={`${meal.strMealThumb}/preview`}
                  alt=""
                  className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-700">
                  {meal.strMeal}
                </p>
                <p className="text-xs text-gray-400">
                  {[meal.strArea, meal.strCategory].filter(Boolean).join(' · ')}
                  <span className="ml-1.5 text-blue-400">
                    · {extractIngredients(meal).length} ingredients
                  </span>
                </p>
              </div>
              <span className="text-blue-300 group-hover:text-blue-500 text-lg leading-none">→</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] text-blue-400 text-center">
        Powered by{' '}
        <span className="font-medium">TheMealDB</span>
        {' '}— click a result to import it
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main RecipeForm
// ---------------------------------------------------------------------------

interface RecipeFormProps {
  recipe?: Recipe;
  onClose: () => void;
  onSaved: (recipe: Recipe) => void;
}

export default function RecipeForm({ recipe, onClose, onSaved }: RecipeFormProps) {
  const isEditing = Boolean(recipe);

  const [showSearch, setShowSearch] = useState(!isEditing);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);

  const [title, setTitle] = useState(recipe?.title ?? '');
  const [description, setDescription] = useState(recipe?.description ?? '');
  const [servings, setServings] = useState<string>(recipe?.servings?.toString() ?? '');
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [ingredients, setIngredients] = useState<string[]>(
    recipe?.ingredients.map((i) => i.text) ?? ['']
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showSearch) titleRef.current?.focus();
  }, [showSearch]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose]);

  function handleImport(meal: MealDBMeal) {
    setTitle(meal.strMeal);
    const parts = [meal.strArea, meal.strCategory].filter(Boolean);
    setDescription(parts.join(' · '));
    const imported = extractIngredients(meal);
    setIngredients(imported.length > 0 ? imported : ['']);
    setNotes(meal.strInstructions?.trim() ?? '');
    setServings('');
    setImportedFrom(meal.strMeal);
    setShowSearch(false);
    // Focus title so user can adjust
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  function updateIngredient(i: number, val: string) {
    setIngredients((prev) => prev.map((x, idx) => (idx === i ? val : x)));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, '']);
  }

  function removeIngredient(i: number) {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (i === ingredients.length - 1) addIngredient();
    }
    if (e.key === 'Backspace' && ingredients[i] === '' && ingredients.length > 1) {
      e.preventDefault();
      removeIngredient(i);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }

    setSaving(true);
    setError('');

    const payload: RecipeCreate = {
      title: title.trim(),
      description: description.trim() || undefined,
      servings: servings ? Number(servings) : undefined,
      notes: notes.trim() || undefined,
      ingredients: ingredients
        .map((t, i) => ({ text: t.trim(), position: i }))
        .filter((x) => x.text),
    };

    try {
      const saved = isEditing && recipe
        ? await recipesApi.update(recipe.id, payload)
        : await recipesApi.create(payload);
      onSaved(saved);
    } catch {
      setError('Failed to save recipe. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800">
              {isEditing ? 'Edit Recipe' : 'New Recipe'}
            </h2>
            {importedFrom && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                Imported
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Search panel */}
          {showSearch ? (
            <SearchPanel
              onSelect={handleImport}
              onCollapse={() => setShowSearch(false)}
            />
          ) : (
            !isEditing && (
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                className="w-full flex items-center gap-2 justify-center py-2 rounded-lg border border-dashed border-blue-200 text-blue-500 text-sm hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <SearchIcon />
                Search online for a recipe
              </button>
            )
          )}

          {/* Manual entry form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Recipe name <span className="text-red-500">*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Spaghetti Bolognese"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description or category…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="w-24">
                <label className="block text-sm font-medium text-slate-700 mb-1">Serves</label>
                <input
                  type="number"
                  min={1}
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  placeholder="4"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Ingredients</label>
                <span className="text-xs text-slate-400">{ingredients.filter(i => i.trim()).length} item{ingredients.filter(i => i.trim()).length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-1.5">
                {ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs w-4 text-right flex-shrink-0">{i + 1}.</span>
                    <input
                      type="text"
                      value={ing}
                      onChange={(e) => updateIngredient(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i)}
                      placeholder="e.g. 200g plain flour"
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus={i === ingredients.length - 1 && i > 0}
                    />
                    {ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIngredient(i)}
                        className="text-slate-300 hover:text-red-400 flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addIngredient}
                className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                + Add ingredient
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Method / Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instructions, tips, or cooking notes…"
                rows={5}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Recipe'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------
function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
