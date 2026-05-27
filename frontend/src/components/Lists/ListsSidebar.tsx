import { useState, useRef, useEffect } from 'react';
import { listsApi } from '@/api/client';
import type { CustomList } from '@/types';

interface ListsSidebarProps {
  lists: CustomList[];
  selectedListId: number | null;
  onSelect: (list: CustomList) => void;
  onDeleted: (id: number) => void;
  onCreated: (list: CustomList) => void;
}

// Default colours to cycle through for new lists
const DEFAULT_COLOURS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#F97316', // orange
  '#06B6D4', // cyan
  '#EC4899', // pink
];

export default function ListsSidebar({
  lists,
  selectedListId,
  onSelect,
  onDeleted,
  onCreated,
}: ListsSidebarProps) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingListId, setDeletingListId] = useState<number | null>(null);
  const newListInputRef = useRef<HTMLInputElement>(null);

  // Focus the inline input when it appears
  useEffect(() => {
    if (creatingNew && newListInputRef.current) {
      newListInputRef.current.focus();
    }
  }, [creatingNew]);

  function pickColour(): string {
    return DEFAULT_COLOURS[lists.length % DEFAULT_COLOURS.length];
  }

  async function handleCreateList() {
    const trimmed = newListName.trim();
    if (!trimmed) {
      setCreatingNew(false);
      setNewListName('');
      return;
    }
    setSaving(true);
    try {
      const created = await listsApi.create({ name: trimmed, colour: pickColour() });
      setNewListName('');
      setCreatingNew(false);
      onCreated(created);
    } catch (err) {
      console.error('Failed to create list:', err);
    } finally {
      setSaving(false);
    }
  }

  function handleNewListKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateList();
    } else if (e.key === 'Escape') {
      setNewListName('');
      setCreatingNew(false);
    }
  }

  async function handleConfirmDelete(list: CustomList) {
    setDeletingListId(null);
    try {
      await listsApi.remove(list.id);
      onDeleted(list.id);
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-gray-50 border-r border-gray-100 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">My Lists</h2>
        <button
          type="button"
          onClick={() => setCreatingNew(true)}
          title="New list"
          className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors text-sm leading-none"
        >
          +
        </button>
      </div>

      {/* Inline new-list input */}
      {creatingNew && (
        <div className="px-3 pb-2">
          <input
            ref={newListInputRef}
            type="text"
            placeholder="List name..."
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onBlur={handleCreateList}
            onKeyDown={handleNewListKeyDown}
            disabled={saving}
            className="w-full text-sm text-gray-800 bg-white border border-primary-300 rounded-lg px-3 py-1.5 outline-none focus:border-primary-500 transition-colors"
          />
        </div>
      )}

      {/* List of lists */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {lists.length === 0 && !creatingNew && (
          <p className="text-sm text-gray-400 text-center mt-6 px-2">
            No lists yet. Tap + above to create one.
          </p>
        )}

        {lists.map((list) => {
          const isSelected = list.id === selectedListId;
          const uncheckedCount = list.items.filter((i) => !i.checked).length;
          const totalCount = list.items.length;

          // Inline delete confirmation state
          if (deletingListId === list.id) {
            return (
              <div
                key={list.id}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg text-sm"
              >
                <span className="text-red-600 flex-1 text-xs">Delete "{list.name}"?</span>
                <button
                  onClick={() => handleConfirmDelete(list)}
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                >
                  Yes
                </button>
                <button
                  onClick={() => setDeletingListId(null)}
                  className="px-2 py-1 border border-gray-200 rounded text-xs"
                >
                  No
                </button>
              </div>
            );
          }

          return (
            <div
              key={list.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(list)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(list)}
              className={[
                'group flex items-center gap-2 w-full px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm',
                isSelected
                  ? 'bg-white border border-primary-200 text-primary-700 shadow-sm'
                  : 'text-gray-700 hover:bg-white hover:shadow-sm',
              ].join(' ')}
            >
              {/* Coloured dot */}
              <span
                className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: list.colour ?? '#94A3B8' }}
              />

              {/* List name */}
              <span className="flex-1 truncate font-medium">{list.name}</span>

              {/* Item count badge */}
              {totalCount > 0 && (
                <span
                  className={[
                    'flex-shrink-0 min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-medium flex items-center justify-center',
                    isSelected
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-200 text-gray-600',
                  ].join(' ')}
                >
                  {uncheckedCount > 0 ? uncheckedCount : totalCount}
                </span>
              )}

              {/* Delete button — triggers inline confirmation */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingListId(list.id);
                }}
                aria-label={`Delete ${list.name}`}
                className="flex-shrink-0 p-0.5 rounded text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(pointer:coarse)]:opacity-100"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
