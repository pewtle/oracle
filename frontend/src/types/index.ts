// ---------------------------------------------------------------------------
// TypeScript interfaces matching backend Pydantic schemas
// ---------------------------------------------------------------------------

export interface Profile {
  id: number;
  name: string;
  colour: string;         // hex colour string, e.g. "#FF5733"
  avatar_emoji: string;
  google_calendar_id?: string;
  created_at: string;     // ISO datetime string
}

export interface CalendarEvent {
  id: number;
  title: string;
  date: string;           // ISO date string, e.g. "2024-03-15"
  start_time?: string;    // "HH:MM:SS" or undefined for all-day
  end_time?: string;
  all_day: boolean;
  colour_override?: string;
  google_event_id?: string;
  google_calendar_id?: string;
  source: 'local' | 'google';
  recurrence_rule?: string | null;      // JSON string: {"frequency":"daily"|"weekly","days":["mon","wed",...]}
  is_recurring_instance?: boolean;      // true for expanded virtual instances
  recurrence_source_id?: number | null; // ID of the template event, for instances
  created_at: string;
  updated_at: string;
  profiles: Profile[];
}

export interface Task {
  id: number;
  title: string;
  due_date?: string;      // ISO date string
  completed: boolean;
  completed_at?: string;  // ISO datetime string
  profile_id: number;
  profile?: Profile;
  subject_profile_id?: number;  // who/what the task is about (e.g. the dog)
  subject_profile?: Profile;    // populated profile object
  recurrence_rule?: string | null;  // JSON: {"frequency":"daily"|"weekly","days":["mon",...]}
  created_at: string;
  is_overdue: boolean;
}

export interface MealPlan {
  id: number;
  date: string;           // ISO date string
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  description: string;
}

export interface ListItem {
  id: number;
  list_id: number;
  text: string;
  checked: boolean;
  position: number;
  created_at: string;
}

export interface CustomList {
  id: number;
  name: string;
  colour?: string;
  created_at: string;
  items: ListItem[];
}

// ---------------------------------------------------------------------------
// API request / create types
// ---------------------------------------------------------------------------

export interface ProfileCreate {
  name: string;
  colour: string;
  avatar_emoji?: string;
  google_calendar_id?: string;
}

export interface CalendarEventCreate {
  title: string;
  date: string;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  colour_override?: string;
  source?: 'local' | 'google';
  profile_ids?: number[];
  recurrence_rule?: string | null;
}

export interface TaskCreate {
  title: string;
  due_date?: string;
  completed?: boolean;
  profile_id: number;
  subject_profile_id?: number;  // who/what the task is about
  recurrence_rule?: string | null;
}

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  text: string;
  position: number;
  created_at: string;
}

export interface Recipe {
  id: number;
  title: string;
  description?: string;
  servings?: number;
  notes?: string;
  created_at: string;
  ingredients: RecipeIngredient[];
}

export interface RecipeCreate {
  title: string;
  description?: string;
  servings?: number;
  notes?: string;
  ingredients: { text: string; position: number }[];
}

export interface MealPlanCreate {
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  description: string;
}

export interface CustomListCreate {
  name: string;
  colour?: string;
}

export interface ListItemCreate {
  text: string;
  checked?: boolean;
  position?: number;
}
