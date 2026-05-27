import { useState, useEffect, useRef } from 'react';
import type { Recipe, RecipeCreate } from '@/types';
import { recipesApi } from '@/api/client';

interface RecipeFormProps {
  recipe?: Recipe;
  onClose: () => void;
  onSaved: (recipe: Recipe) => void;
}

export default function RecipeForm({ recipe, onClose, onSaved }: RecipeFormProps) {
  const isEditing = Boolean(recipe);

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
  useEffect(() => { titleRef.current?.focus(); }, []);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose]);

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEditing ? 'Edit Recipe' : 'New Recipe'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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
                placeholder="Short description…"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Ingredients
            </label>
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
              rows={4}
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
  );
}
