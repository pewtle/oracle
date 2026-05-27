import { useState, useRef, useEffect } from 'react';
import type { ListItem } from '@/types';

interface ListItemRowProps {
  item: ListItem;
  listId: number;
  onToggle: () => void;
  onDelete: () => void;
  onTextUpdate: (text: string) => void;
}

export default function ListItemRow({
  item,
  onToggle,
  onDelete,
  onTextUpdate,
}: ListItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editText when item.text changes externally
  useEffect(() => {
    if (!editing) {
      setEditText(item.text);
    }
  }, [item.text, editing]);

  function startEditing() {
    setEditText(item.text);
    setEditing(true);
  }

  function commitEdit() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.text) {
      onTextUpdate(trimmed);
    } else {
      setEditText(item.text);
    }
    setEditing(false);
  }

  function cancelEdit() {
    setEditText(item.text);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }

  // Focus the input as soon as editing mode starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  return (
    <div className="group flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-gray-50 transition-colors">
      {/* Custom large checkbox — increased to 24px minimum for touch */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={item.checked ? 'Uncheck item' : 'Check item'}
        className={[
          'flex-shrink-0 w-6 h-6 min-w-[24px] rounded-md border-2 flex items-center justify-center transition-colors',
          item.checked
            ? 'bg-green-500 border-green-500'
            : 'bg-white border-gray-300 hover:border-primary-400',
        ].join(' ')}
      >
        {item.checked && (
          <svg
            className="w-3.5 h-3.5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Item text / inline editor */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full text-base text-gray-800 bg-transparent border-0 border-b border-primary-400 outline-none py-0.5"
          />
        ) : (
          <span
            role="button"
            tabIndex={0}
            onClick={startEditing}
            onKeyDown={(e) => e.key === 'Enter' && startEditing()}
            className={[
              'block text-base cursor-text truncate select-none',
              item.checked ? 'line-through text-gray-400' : 'text-gray-800',
            ].join(' ')}
          >
            {item.text}
            {/* Edit hint — only visible on touch devices */}
            <span className="[@media(pointer:coarse)]:inline hidden text-xs text-gray-300 ml-1">✏️</span>
          </span>
        )}
      </div>

      {/* Delete button — always visible on touch devices, on hover for pointer */}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete item"
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(pointer:coarse)]:opacity-100"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <svg
          className="w-4 h-4"
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
}
