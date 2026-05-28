import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProfileProvider } from '@/contexts/ProfileContext';
import AppShell from './components/Layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import TasksPage from './pages/TasksPage';
import ChoreScreenPage from './pages/ChoreScreenPage';
import MealPlannerPage from './pages/MealPlannerPage';
import ListsPage from './pages/ListsPage';
import SettingsPage from './pages/SettingsPage';
import RecipesPage from './pages/RecipesPage';
import RoutinesPage from './pages/RoutinesPage';
import ScreensaverPage from './pages/ScreensaverPage';

export default function App() {
  return (
    <BrowserRouter>
      <ProfileProvider>
        <Routes>
          {/* Standalone full-screen pages — no AppShell */}
          <Route path="/chores"      element={<ChoreScreenPage />} />
          <Route path="/screensaver" element={<ScreensaverPage />} />

          {/* All other routes share the AppShell layout (sidebar + topbar) */}
          <Route element={<AppShell />}>
            <Route path="/"         element={<DashboardPage />}   />
            <Route path="/calendar" element={<CalendarPage />}    />
            <Route path="/tasks"    element={<TasksPage />}        />
            <Route path="/meals"    element={<MealPlannerPage />}  />
            <Route path="/lists"    element={<ListsPage />}        />
            <Route path="/recipes"   element={<RecipesPage />}   />
            <Route path="/routines"  element={<RoutinesPage />}  />
            <Route path="/settings"  element={<SettingsPage />}  />
          </Route>
        </Routes>
      </ProfileProvider>
    </BrowserRouter>
  );
}
