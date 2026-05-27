import axios from 'axios';
import type {
  Profile,
  ProfileCreate,
  CalendarEvent,
  CalendarEventCreate,
  Task,
  TaskCreate,
  MealPlan,
  MealPlanCreate,
  CustomList,
  CustomListCreate,
  ListItem,
  ListItemCreate,
  Recipe,
  RecipeCreate,
} from '../types';

// ---------------------------------------------------------------------------
// Base axios instance
// In development Vite proxies /api → http://localhost:8000
// In production the FastAPI server serves everything from one origin
// ---------------------------------------------------------------------------
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export const profilesApi = {
  getAll: () => api.get<Profile[]>('/profiles/').then(r => r.data),
  getOne: (id: number) => api.get<Profile>(`/profiles/${id}`).then(r => r.data),
  create: (data: ProfileCreate) => api.post<Profile>('/profiles/', data).then(r => r.data),
  update: (id: number, data: Partial<ProfileCreate>) =>
    api.patch<Profile>(`/profiles/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/profiles/${id}`).then(r => r.data),
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export const eventsApi = {
  getAll: (params?: { start?: string; end?: string; date?: string; profile_id?: number }) =>
    api.get<CalendarEvent[]>('/events/', { params }).then(r => r.data),
  getOne: (id: number) => api.get<CalendarEvent>(`/events/${id}`).then(r => r.data),
  create: (data: CalendarEventCreate) =>
    api.post<CalendarEvent>('/events/', {
      title: data.title,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      all_day: data.all_day,
      colour_override: data.colour_override,
      source: data.source,
      profile_ids: data.profile_ids,
      recurrence_rule: data.recurrence_rule ?? null,
    }).then(r => r.data),
  update: (id: number, data: Partial<CalendarEventCreate>) =>
    api.patch<CalendarEvent>(`/events/${id}`, {
      ...data,
      recurrence_rule: data.recurrence_rule ?? null,
    }).then(r => r.data),
  remove: (id: number) => api.delete(`/events/${id}`).then(r => r.data),
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export const tasksApi = {
  getAll: (params?: { profile_id?: number; completed?: boolean }) =>
    api.get<Task[]>('/tasks/', { params }).then(r => r.data),
  getOne: (id: number) => api.get<Task>(`/tasks/${id}`).then(r => r.data),
  create: (data: TaskCreate) =>
    api.post<Task>('/tasks/', {
      title: data.title,
      due_date: data.due_date,
      completed: data.completed,
      profile_id: data.profile_id,
      ...(data.subject_profile_id !== undefined && { subject_profile_id: data.subject_profile_id }),
      recurrence_rule: data.recurrence_rule ?? null,
    }).then(r => r.data),
  update: (id: number, data: TaskCreate) =>
    api.put<Task>(`/tasks/${id}`, {
      title: data.title,
      due_date: data.due_date,
      completed: data.completed,
      profile_id: data.profile_id,
      ...(data.subject_profile_id !== undefined && { subject_profile_id: data.subject_profile_id }),
      recurrence_rule: data.recurrence_rule ?? null,
    }).then(r => r.data),
  complete: (id: number) => api.patch<Task>(`/tasks/${id}/complete`).then(r => r.data),
  uncomplete: (id: number) => api.patch<Task>(`/tasks/${id}/uncomplete`).then(r => r.data),
  remove: (id: number) => api.delete(`/tasks/${id}`).then(r => r.data),
};

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------
export const mealsApi = {
  getAll: (params?: { date?: string; week_start?: string }) =>
    api.get<MealPlan[]>('/meals/', { params }).then(r => r.data),
  getOne: (id: number) => api.get<MealPlan>(`/meals/${id}`).then(r => r.data),
  create: (data: MealPlanCreate) => api.post<MealPlan>('/meals/', data).then(r => r.data),
  update: (id: number, data: Partial<MealPlanCreate>) =>
    api.patch<MealPlan>(`/meals/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/meals/${id}`).then(r => r.data),
};

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------
export const recipesApi = {
  getAll: () => api.get<Recipe[]>('/recipes/').then(r => r.data),
  getOne: (id: number) => api.get<Recipe>(`/recipes/${id}`).then(r => r.data),
  create: (data: RecipeCreate) => api.post<Recipe>('/recipes/', data).then(r => r.data),
  update: (id: number, data: RecipeCreate) => api.put<Recipe>(`/recipes/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/recipes/${id}`).then(r => r.data),
};

// ---------------------------------------------------------------------------
// Photos (screensaver)
// ---------------------------------------------------------------------------
export const photosApi = {
  list: () => api.get<string[]>('/photos/').then(r => r.data),
  url: (filename: string) => `${API_BASE}/photos/${encodeURIComponent(filename)}`,
};

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------
export const listsApi = {
  getAll: () => api.get<CustomList[]>('/lists/').then(r => r.data),
  getOne: (id: number) => api.get<CustomList>(`/lists/${id}`).then(r => r.data),
  create: (data: CustomListCreate) => api.post<CustomList>('/lists/', data).then(r => r.data),
  update: (id: number, data: Partial<CustomListCreate>) =>
    api.patch<CustomList>(`/lists/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/lists/${id}`).then(r => r.data),

  // List items
  addItem: (listId: number, data: ListItemCreate) =>
    api.post<ListItem>(`/lists/${listId}/items`, data).then(r => r.data),
  updateItem: (listId: number, itemId: number, data: Partial<ListItemCreate>) =>
    api.patch<ListItem>(`/lists/${listId}/items/${itemId}`, data).then(r => r.data),
  removeItem: (listId: number, itemId: number) =>
    api.delete(`/lists/${listId}/items/${itemId}`).then(r => r.data),
};
