# RTQS Task Manager

A Next.js web application for task prioritization with dynamic metrics, built with Supabase as the database source of truth.

## Features

- **Dynamic Metrics**: Add, edit, and remove metrics beyond the default R, T, Q, S
- **Auto-computed Values**: Value = weighted sum of all metric scores using coefficients
- **Auto-computed Priority**: Priority = Value / Sprint Points
- **Real-time Sorting**: Tasks automatically sort by Gate (Yes first) then Priority (descending)
- **Inline Editing**: Edit tasks, scores, and metrics directly in the table
- **Expandable Task Titles**: Task title inputs automatically expand to fit full content
- **ClickUp Links**: Attach links to tasks (e.g., ClickUp URLs) - click to open or edit
- **Analytics Dashboard**: Comprehensive charts and visualizations for task analysis
- **Persistent Storage**: All data stored in Supabase PostgreSQL database

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   
   Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Then edit `.env.local` with your Supabase project URL and anon key:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

   **Note:** The Supabase project has already been created and configured. The credentials are in `.env.local` (not committed to git).

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Tasks Page (`/tasks`)

- **View tasks**: See all tasks in a table with dynamic metric columns
- **Add task**: 
  - Enter task title in the expandable textarea (auto-resizes)
  - Click the link icon (🔗) to optionally add a ClickUp or other URL
  - Click "Add Task" to create
- **Edit task**: Click on any cell to edit inline:
  - Task title: Click and type (textarea expands automatically)
  - Metric scores: Use dropdowns (1, 3, or 5)
  - Gate: Select Yes/No
  - Sprint Points: Select from predefined values (1, 2, 3, 5, 8, 13, 21)
  - Link: Click the link icon to add/edit - click the link text to open in new tab
- **Delete task**: Click the "Delete" button in the Actions column
- **Auto-sorting**: Tasks automatically sort by:
  1. Gate = Yes first, then Gate = No
  2. Priority (descending) within each gate group
  3. Created date (descending) as tiebreaker

### Metrics Page (`/metrics`)

- **View metrics**: See all metrics with their coefficients and status
- **Add metric**: Enter name and coefficient, then click "Add Metric"
- **Edit metric**: 
  - Click on metric name to rename
  - Change coefficient by editing the number field
- **Reorder metrics**: Use ↑ and ↓ buttons to change display order
- **Deactivate metric**: Click the status button to toggle active/inactive
- **Delete metric**: Click "Delete" to permanently remove (removes all scores)

### Analytics Page (`/analytics`)

- **Overall View**: 
  - Task Priority Overview bar chart showing top 15 tasks by priority
  - Priority vs Sprint Points scatter plot
- **Metric Analysis**:
  - Select "All Metrics" to see comparison across all metrics
  - Select a specific metric (R, T, Q, S, etc.) to see detailed score analysis
  - Shows score distribution and weighted scores per task
- **Sprint Points**: 
  - Distribution of tasks by sprint points
  - Average priority per sprint point value
- **Priority Distribution**: 
  - Pie chart showing how tasks are distributed across priority ranges
- **Comparisons**:
  - Gate comparison (Yes vs No) showing task counts, avg priority, and avg value

### How It Works

1. **Value Calculation**: 
   - Value = Σ(score × coefficient) for all active metrics
   - Missing scores are treated as 0

2. **Priority Calculation**:
   - Priority = Value / Sprint Points
   - Automatically updates when any score, coefficient, or sprint points change

3. **Dynamic Columns**:
   - When you add a new metric, it immediately appears as a column in the Tasks table
   - Existing tasks show a "-" (0) for the new metric until you set a score

## Database Schema

The app uses three main tables:

- **metrics**: Stores metric definitions (name, coefficient, sort_order, is_active)
- **tasks**: Stores task information (title, gate, sprint_points, link)
- **task_scores**: Junction table linking tasks to metrics with scores (1, 3, or 5)

A PostgreSQL view (`task_priorities`) computes Value and Priority in real-time.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (PostgreSQL + API)
- **@supabase/supabase-js**
- **Recharts** (Charting library)

## Project Structure

```
├── app/
│   ├── tasks/          # Tasks page with editable table
│   ├── metrics/        # Metrics CRUD page
│   ├── analytics/      # Analytics page with charts
│   ├── layout.tsx      # Root layout with navigation
│   └── globals.css     # Global styles
├── lib/
│   └── supabase.ts     # Supabase client and types
└── README.md
```

## Notes

- All data persists to Supabase PostgreSQL database
- Sorting and calculations happen in real-time as you edit
- The app uses Row Level Security (RLS) with open policies for simplicity
- To add authentication, update the RLS policies in Supabase dashboard

