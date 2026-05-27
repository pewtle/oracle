/**
 * ChoreScreenPage
 *
 * IMPORTANT FOR ROUTING:
 * This page is intentionally designed to run WITHOUT the AppShell layout
 * (no sidebar, no top bar). The /chores route must be placed OUTSIDE the
 * AppShell layout route in App.tsx, like this:
 *
 *   <Routes>
 *     <Route path="/chores" element={<ChoreScreenPage />} />   // <-- outside AppShell
 *     <Route element={<AppShell />}>
 *       <Route path="/" element={<CalendarPage />} />
 *       <Route path="/tasks" element={<TasksPage />} />
 *       ...
 *     </Route>
 *   </Routes>
 *
 * ChoreScreen handles its own full-screen layout and Back navigation.
 */

import ChoreScreen from '@/components/ChoreScreen/ChoreScreen';

export default function ChoreScreenPage() {
  return <ChoreScreen />;
}
