# Odysseus Family Planner Clone — User Stories

Derived from Requirements v1.0 (2026-05-26)

---

## Epic 1: Family Profiles

**US-01** — As a parent, I want to create family member profiles with a name, colour, and avatar so each person has their own identity in the app.
- Acceptance: Profile appears in sidebar/nav; colour is applied across all views; dog profile supported

**US-02** — As a parent, I want to edit or delete a profile so I can keep the family list accurate.
- Acceptance: Changes immediately reflected across all views

---

## Epic 2: Calendar

**US-03** — As a family member, I want to view the calendar in daily view so I can see everything happening today.
- Acceptance: All events for the day shown, colour-coded by member; navigate prev/next day

**US-04** — As a family member, I want to view the calendar in weekly view so I can see the week ahead at a glance.
- Acceptance: 7-day grid, colour-coded events per member; navigate prev/next week

**US-05** — As a family member, I want to view the calendar in monthly view so I can see the whole month.
- Acceptance: Month grid with event indicators per day; navigate prev/next month

**US-06** — As a parent, I want to create a calendar event with a title, date, optional time, and assigned family members so the schedule stays up to date.
- Acceptance: Event appears in correct view; assigned member colour applied; multi-member events supported

**US-07** — As a parent, I want to edit or delete a calendar event so I can correct mistakes or remove cancelled plans.
- Acceptance: Changes reflected immediately in all views

---

## Epic 3: Google Calendar Sync

**US-08** — As a family member, I want to connect my Google Calendar to my profile via OAuth so my Google events appear in the family planner.
- Acceptance: OAuth flow completes; Google events visible colour-coded with profile colour

**US-09** — As a family member, I want events I create in the family planner to appear in my linked Google Calendar so I have everything in one place.
- Acceptance: New events appear in Google Calendar within 10 minutes

**US-10** — As a parent, I want the Google Calendar sync to happen automatically every 10 minutes so the planner stays up to date without manual action.
- Acceptance: Sync runs in background; new/changed/deleted Google events reflected locally

---

## Epic 4: Task Manager

**US-11** — As a parent, I want to create a task with a title, due date, and assigned family member (including the dog) so responsibilities are clear.
- Acceptance: Task appears in task list for the assigned member; dog is a valid assignee

**US-12** — As a family member, I want to mark a task as complete so I can track what's been done.
- Acceptance: Task marked with visual completion state; removed from active task list or shown as done

**US-13** — As a family member, I want overdue tasks to be visually highlighted in red so nothing gets forgotten.
- Acceptance: Any incomplete task past its due date shows a clear red/overdue indicator automatically

**US-14** — As a parent, I want to edit or delete tasks so I can keep the task list accurate.
- Acceptance: Changes reflected immediately

---

## Epic 5: Chore Screen

**US-15** — As a parent, I want to pull up a dedicated full-screen chore view from the main interface with one tap so the child can see their tasks clearly.
- Acceptance: Accessible via single tap; opens in full-screen; shows all family members' chores

**US-16** — As a 7-year-old, I want to see my chores in large text with clear icons so I can understand them without adult help.
- Acceptance: Font size ≥ 24px; member avatar/colour prominent; no complex navigation required

**US-17** — As a 7-year-old, I want to tap a chore to mark it as done so I feel a sense of achievement.
- Acceptance: Single tap marks complete; visual confirmation (checkmark/strikethrough); persists on refresh

---

## Epic 6: Meal Planner

**US-18** — As a parent, I want to plan breakfast, lunch, and dinner for each day of the week so we know what we're eating.
- Acceptance: Weekly grid showing 3 meal slots per day; current week shown by default

**US-19** — As a parent, I want to add, edit, and remove meal entries so the plan can be adjusted as needed.
- Acceptance: Changes saved immediately and visible to all family devices

---

## Epic 7: Custom Lists

**US-20** — As a family member, I want to create a named custom list (e.g. shopping list, packing list) so I can track items to buy or do.
- Acceptance: List created with a name; items can be added; list visible in navigation

**US-21** — As a family member, I want to check off items on a list so I can track completion without deleting items.
- Acceptance: Checkbox per item; checked items visually distinct (strikethrough); persist on refresh

**US-22** — As a family member, I want to delete completed items or clear a list so it stays tidy.
- Acceptance: Delete individual items or clear-all option available

---

## Epic 8: Infrastructure & Hosting

**US-23** — As a family member, I want to access the planner from any device on the home network so I can use a tablet, phone, or the wall screen.
- Acceptance: App accessible at http://odysseus.local or local IP from any device on network

**US-24** — As an admin, I want the app to start automatically when the Raspberry Pi boots so it's always available without manual intervention.
- Acceptance: systemd service configured; app accessible within 60s of Pi boot

**US-25** — As a user, I want the interface to look good on both a large wall-mounted screen and a tablet so it works in both contexts.
- Acceptance: Responsive layout tested at 1920×1080 (landscape) and 768×1024 (tablet)

---

## Tech Stack

| Layer       | Choice                                    |
|-------------|-------------------------------------------|
| Backend     | Python 3 + FastAPI                        |
| Database    | SQLite via SQLAlchemy                     |
| Frontend    | React + TypeScript + Vite                 |
| Styling     | TailwindCSS                               |
| Google Auth | google-auth-oauthlib + google-api-python-client |
| Serving     | Uvicorn (backend) + FastAPI static files  |
| Pi Service  | systemd unit file                         |

---

## Story Map (Implementation Order)

```
Wave 1 (Foundation — sequential):
  Foundation Agent → project skeleton, models, API shell, React app shell

Wave 2 (Features — parallel):
  Agent A → Profiles (US-01, US-02) + Colour Coding
  Agent B → Calendar views (US-03–05) + Event CRUD (US-06, US-07)
  Agent C → Task Manager (US-11–14) + Chore Screen (US-15–17)
  Agent D → Meal Planner (US-18–19)
  Agent E → Custom Lists (US-20–22)
  Agent F → Google Calendar Sync (US-08–10)

Wave 3 (Infrastructure):
  Agent G → Raspberry Pi setup, systemd service, mDNS (US-23–25)
```
