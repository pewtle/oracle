import { useState, useRef, useEffect } from 'react';
import { api, listsApi } from '@/api/client';
import type { CustomList, ListItem } from '@/types';
import ListItemRow from './ListItemRow';

interface ListDetailProps {
  list: CustomList;
  onUpdated: () => void;
}

export default function ListDetail({ list, onUpdated }: ListDetailProps) {
  const [newItemText, setNewItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Inline list rename state
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState(list.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sync name when the list prop changes (e.g. parent refreshes)
  useEffect(() => {
    if (!editingName) {
      setNameText(list.name);
    }
  }, [list.name, editingName]);

  // Focus the name input when entering edit mode
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const checkedCount = list.items.filter((i) => i.checked).length;

  // -------------------------------------------------------------------------
  // List name rename
  // -------------------------------------------------------------------------
  async function commitRename() {
    const trimmed = nameText.trim();
    setEditingName(false);
    if (!trimmed || trimmed === list.name) {
      setNameText(list.name);
      return;
    }
    try {
      await listsApi.update(list.id, { name: trimmed });
      onUpdated();
    } catch (err) {
      console.error('Failed to rename list:', err);
      setNameText(list.name);
    }
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      setNameText(list.name);
      setEditingName(false);
    }
  }

  // -------------------------------------------------------------------------
  // Add new item
  // -------------------------------------------------------------------------
  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    setAddingItem(true);
    try {
      await listsApi.addItem(list.id, { text: trimmed });
      setNewItemText('');
      onUpdated();
    } catch (err) {
      console.error('Failed to add item:', err);
    } finally {
      setAddingItem(false);
    }
  }

  function handleNewItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem(e as unknown as React.FormEvent);
    }
  }

  // -------------------------------------------------------------------------
  // Toggle item checked
  // -------------------------------------------------------------------------
  async function handleToggle(item: ListItem) {
    try {
      await listsApi.updateItem(list.id, item.id, { checked: !item.checked });
      onUpdated();
    } catch (err) {
      console.error('Failed to toggle item:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Delete item
  // -------------------------------------------------------------------------
  async function handleDeleteItem(item: ListItem) {
    try {
      await listsApi.removeItem(list.id, item.id);
      onUpdated();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Update item text
  // -------------------------------------------------------------------------
  async function handleTextUpdate(item: ListItem, newText: string) {
    try {
      await listsApi.updateItem(list.id, item.id, { text: newText });
      onUpdated();
    } catch (err) {
      console.error('Failed to update item text:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Clear all checked items
  // -------------------------------------------------------------------------
  async function handleClearChecked() {
    try {
      await api.post(`/lists/${list.id}/items/clear-checked`);
      onUpdated();
    } catch (err) {
      console.error('Failed to clear checked items:', err);
    }
  }

  return (
    <div className="bg-white flex-1 p-6 flex flex-col min-h-0">
      {/* Header row: list name + clear completed button */}
      <div className="flex items-center justify-between mb-4">
        {/* Inline editable list name */}
        <div className="flex-1 min-w-0 mr-4">
          {editingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={nameText}
              onChange={(e) => setNameText(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleNameKeyDown}
              className="text-2xl font-bold text-slate-800 bg-transparent border-0 border-b-2 border-primary-400 outline-none w-full"
            />
          ) : (
            <h2
              role="button"
              tabIndex={0}
              onClick={() => setEditingName(true)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingName(true)}
              className="text-2xl font-bold text-slate-800 cursor-pointer hover:text-primary-600 transition-colors truncate"
              title="Click to rename"
            >
              {list.name}
              {/* Rename hint — only visible on touch devices */}
              <span className="[@media(pointer:coarse)]:inline hidden text-base text-gray-300 ml-2">✏️</span>
            </h2>
          )}
        </div>

        {/* Clear completed button — only shown when there are checked items */}
        {checkedCount > 0 && (
          <button
            type="button"
            onClick={handleClearChecked}
            className="flex-shrink-0 text-sm text-red-500 hover:text-red-700 transition-colors min-h-[36px] py-2 px-1"
          >
            Clear completed ({checkedCount})
          </button>
        )}
      </div>

      {/* New item input */}
      <form onSubmit={handleAddItem} className="mb-4">
        <input
          type="text"
          placeholder="+ Add item"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleNewItemKeyDown}
          disabled={addingItem}
          className="border-0 border-b-2 border-dashed border-gray-200 focus:border-primary-400 rounded-none w-full py-2 text-base text-gray-700 placeholder-gray-400 bg-transparent outline-none transition-colors"
        />
      </form>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {list.items.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-400 text-sm">
              Nothing on this list yet. Add the first item above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {list.items.map((item) => (
              <ListItemRow
                key={item.id}
                item={item}
                listId={list.id}
                onToggle={() => handleToggle(item)}
                onDelete={() => handleDeleteItem(item)}
                onTextUpdate={(text) => handleTextUpdate(item, text)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
