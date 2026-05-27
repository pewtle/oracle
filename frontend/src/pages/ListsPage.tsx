import { useState, useEffect, useCallback, useRef } from 'react';
import { listsApi } from '@/api/client';
import type { CustomList } from '@/types';
import { ListsSidebar, ListDetail } from '@/components/Lists';

export default function ListsPage() {
  const [lists, setLists] = useState<CustomList[]>([]);
  const [selectedList, setSelectedList] = useState<CustomList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // When a list is created, store its id here so fetchLists can auto-select it
  const pendingSelectIdRef = useRef<number | null>(null);
  // Track whether the initial auto-restore from localStorage has been attempted
  const restoredFromStorageRef = useRef(false);

  // -------------------------------------------------------------------------
  // Fetch all lists (with items) and sync selected list
  // -------------------------------------------------------------------------
  const fetchLists = useCallback(async () => {
    try {
      const data = await listsApi.getAll();
      setLists(data);
      setError(null);

      setSelectedList((prev) => {
        // If we have a pending auto-select (just created), use that
        const pendingId = pendingSelectIdRef.current;
        if (pendingId !== null) {
          pendingSelectIdRef.current = null;
          const found = data.find((l) => l.id === pendingId) ?? null;
          if (found) localStorage.setItem('odysseus-last-list-id', String(found.id));
          return found;
        }
        // Otherwise keep the current selection in sync with fresh data
        if (!prev) return null;
        return data.find((l) => l.id === prev.id) ?? null;
      });
    } catch (err) {
      console.error('Failed to fetch lists:', err);
      setError('Could not load lists. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Auto-restore last-selected list from localStorage on initial load
  useEffect(() => {
    if (lists.length === 0) return;
    if (restoredFromStorageRef.current) return;
    restoredFromStorageRef.current = true;

    setSelectedList((prev) => {
      // Only restore if nothing is currently selected (e.g. no pending select)
      if (prev !== null) return prev;
      const lastId = localStorage.getItem('odysseus-last-list-id');
      if (!lastId) return null;
      const found = lists.find((l) => l.id === Number(lastId));
      return found ?? null;
    });
  }, [lists]);

  // -------------------------------------------------------------------------
  // Select a list and persist to localStorage
  // -------------------------------------------------------------------------
  function handleSelect(list: CustomList) {
    setSelectedList(list);
    localStorage.setItem('odysseus-last-list-id', String(list.id));
  }

  // -------------------------------------------------------------------------
  // Callbacks from sidebar
  // -------------------------------------------------------------------------
  function handleDeleted(deletedListId: number) {
    // Clear localStorage if the deleted list was the stored one
    const storedId = localStorage.getItem('odysseus-last-list-id');
    if (storedId === String(deletedListId)) {
      localStorage.removeItem('odysseus-last-list-id');
    }
    setSelectedList(null);
    fetchLists();
  }

  function handleCreated(list: CustomList) {
    pendingSelectIdRef.current = list.id;
    fetchLists();
  }

  // -------------------------------------------------------------------------
  // Callback from ListDetail after any mutation
  // -------------------------------------------------------------------------
  function handleUpdated() {
    fetchLists();
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Left sidebar */}
      {loading ? (
        <aside className="w-60 flex-shrink-0 bg-gray-50 border-r border-gray-100 flex items-center justify-center">
          <div className="w-6 h-6 border-4 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
        </aside>
      ) : error ? (
        <aside className="w-60 flex-shrink-0 bg-gray-50 border-r border-gray-100 flex items-center justify-center px-4">
          <p className="text-xs text-red-500 text-center">{error}</p>
        </aside>
      ) : (
        <ListsSidebar
          lists={lists}
          selectedListId={selectedList?.id ?? null}
          onSelect={handleSelect}
          onDeleted={handleDeleted}
          onCreated={handleCreated}
        />
      )}

      {/* Right panel */}
      <main className="flex-1 overflow-y-auto">
        {selectedList ? (
          <ListDetail
            key={selectedList.id}
            list={selectedList}
            onUpdated={handleUpdated}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-center p-8">
            <div className="text-gray-400">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-lg font-medium text-gray-500">Select or create a list</p>
              <p className="text-sm mt-1 text-gray-400">
                Choose a list on the left, or hit{' '}
                <span className="font-semibold text-gray-500">+</span> to create a new one.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
