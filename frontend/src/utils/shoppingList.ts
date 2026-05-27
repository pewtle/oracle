/**
 * Smart "This Week's Shopping" list helper.
 *
 * - Finds the persisted weekly list by cached ID, then by name, then creates it.
 * - Merges duplicate ingredients: if "200g flour" already exists and you add
 *   it again, it becomes "200g flour x2" (then x3, etc.).
 * - Comparison is case-insensitive on the base ingredient text (strips any
 *   existing "x N" suffix before comparing).
 */

import { listsApi } from '@/api/client';
import type { CustomList, ListItem } from '@/types';

const WEEKLY_LIST_NAME = "This Week's Shopping";
const STORAGE_KEY = 'odysseus-weekly-shopping-id';

// ---------------------------------------------------------------------------
// Parse / format helpers
// ---------------------------------------------------------------------------

function parseItem(text: string): { base: string; count: number } {
  const m = text.match(/^(.+?)\s+x\s*(\d+)$/i);
  if (m) return { base: m[1].trim(), count: parseInt(m[2], 10) };
  return { base: text.trim(), count: 1 };
}

function formatItem(base: string, count: number): string {
  return count <= 1 ? base : `${base} x${count}`;
}

// ---------------------------------------------------------------------------
// Get or create the persistent weekly shopping list
// ---------------------------------------------------------------------------

async function getOrCreateWeeklyList(): Promise<CustomList> {
  // 1. Try cached ID
  const cachedId = localStorage.getItem(STORAGE_KEY);
  if (cachedId) {
    try {
      const list = await listsApi.getOne(Number(cachedId));
      return list;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // 2. Search by name
  const all = await listsApi.getAll();
  const found = all.find(l => l.name === WEEKLY_LIST_NAME);
  if (found) {
    localStorage.setItem(STORAGE_KEY, String(found.id));
    return found;
  }

  // 3. Create fresh
  const created = await listsApi.create({ name: WEEKLY_LIST_NAME, colour: '#10b981' });
  localStorage.setItem(STORAGE_KEY, String(created.id));
  return created;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Add `ingredients` to the weekly shopping list, merging duplicates.
 * Returns the list ID so callers can navigate to /lists.
 */
export async function addIngredientsToWeeklyList(ingredients: string[]): Promise<number> {
  const list = await getOrCreateWeeklyList();

  // Fetch fresh items (list from getAll may be stale)
  const fresh = await listsApi.getOne(list.id);
  // Work with a mutable local copy so we can track in-batch duplicates
  const items: (ListItem & { _dirty?: boolean })[] = [...fresh.items];

  let nextPosition = items.length > 0
    ? Math.max(...items.map(i => i.position)) + 1
    : 0;

  for (const raw of ingredients) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const newBase = parseItem(trimmed).base.toLowerCase();

    // Find an existing item whose base matches (case-insensitive)
    const match = items.find(item => parseItem(item.text).base.toLowerCase() === newBase);

    if (match) {
      const { base, count } = parseItem(match.text);
      const updated = formatItem(base, count + 1);
      await listsApi.updateItem(list.id, match.id, { text: updated });
      match.text = updated; // keep local copy in sync for further in-batch dupes
    } else {
      const added = await listsApi.addItem(list.id, {
        text: trimmed,
        checked: false,
        position: nextPosition,
      });
      items.push(added);
      nextPosition++;
    }
  }

  return list.id;
}
