import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Recipe } from '@/types';
import { recipesApi } from '@/api/client';
import { addIngredientsToWeeklyList } from '@/utils/shoppingList';
import RecipeForm from '@/components/Recipes/RecipeForm';

export default function RecipesPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await recipesApi.getAll();
      setRecipes(data);
      // Keep selected in sync if it was updated
      if (selected) {
        const updated = data.find((r) => r.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch {}
    finally { setLoading(false); }
  }, [selected]);

  useEffect(() => { fetchRecipes(); }, []); // eslint-disable-line

  const handleSaved = (recipe: Recipe) => {
    setShowForm(false);
    setEditRecipe(undefined);
    fetchRecipes();
    setSelected(recipe);
  };

  const handleDelete = async (id: number) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }
    await recipesApi.remove(id);
    setDeleteConfirm(null);
    if (selected?.id === id) setSelected(null);
    fetchRecipes();
  };

  const handleExportToList = async () => {
    if (!selected || selected.ingredients.length === 0) return;
    setExporting(true);
    try {
      const listId = await addIngredientsToWeeklyList(
        selected.ingredients.map(i => i.text)
      );
      localStorage.setItem('odysseus-last-list-id', String(listId));
      setExportDone(true);
      setTimeout(() => {
        setExportDone(false);
        navigate('/lists');
      }, 1200);
    } catch {}
    finally { setExporting(false); }
  };

  const filtered = search.trim()
    ? recipes.filter((r) =>
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.description?.toLowerCase().includes(search.toLowerCase())
      )
    : recipes;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🍳 Recipe Book</h1>
        <button
          onClick={() => { setEditRecipe(undefined); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Recipe
        </button>
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        {/* Left: recipe list */}
        <div className="w-72 flex-shrink-0 flex flex-col min-h-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes…"
            className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📖</p>
                <p className="text-sm text-gray-500">
                  {search ? 'No recipes match.' : 'No recipes yet.\nAdd your first one!'}
                </p>
              </div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-3 py-3 rounded-lg transition-colors border ${
                    selected?.id === r.id
                      ? 'bg-primary-50 border-primary-200 text-primary-800'
                      : 'bg-white border-gray-100 text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <p className="font-medium text-sm truncate">{r.title}</p>
                  {r.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{r.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? 's' : ''}
                    {r.servings ? ` · serves ${r.servings}` : ''}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: recipe detail */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
              <p className="text-5xl mb-3">📖</p>
              <p className="text-base font-medium">Select a recipe</p>
              <p className="text-sm mt-1">or create a new one</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selected.title}</h2>
                  {selected.description && (
                    <p className="text-gray-500 mt-1">{selected.description}</p>
                  )}
                  {selected.servings && (
                    <p className="text-sm text-gray-400 mt-1">Serves {selected.servings}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setEditRecipe(selected); setShowForm(true); }}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      deleteConfirm === selected.id
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'text-red-500 border border-red-200 hover:bg-red-50'
                    }`}
                  >
                    {deleteConfirm === selected.id ? 'Confirm?' : 'Delete'}
                  </button>
                </div>
              </div>

              {/* Ingredients */}
              {selected.ingredients.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Ingredients
                  </h3>
                  <ul className="space-y-1">
                    {selected.ingredients.map((ing) => (
                      <li key={ing.id} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-gray-300 mt-0.5">•</span>
                        {ing.text}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={handleExportToList}
                    disabled={exporting || exportDone}
                    className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      exportDone
                        ? 'bg-green-500 text-white'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60'
                    }`}
                  >
                    {exportDone ? (
                      "✓ Added to This Week's Shopping!"
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Add to This Week's Shopping
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Method / Notes */}
              {selected.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Method
                  </h3>
                  <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                    {selected.notes}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <RecipeForm
          recipe={editRecipe}
          onClose={() => { setShowForm(false); setEditRecipe(undefined); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
