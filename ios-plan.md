# Plan: iOS App — Todo of Fortune

## Context
The existing app is a Python Flask web server + HTML/CSS/JS frontend, requiring a laptop to run. The goal is a standalone iOS app that stores data locally on-device, supports adding/editing todos, and reproduces the full spin-wheel behaviour. No server is needed; all logic moves to the client.

---

## Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | **Expo (React Native, TypeScript)** | JS logic (probability, dates, weights) ports directly; Expo Go for device testing without a full Xcode build; produces a real native app (not a WebView) |
| Navigation | **Expo Router** (file-based) | Current Expo standard; each screen is a file |
| Data | **expo-sqlite** | Relational, persistent, matches the CSV schema; no server |
| Wheel drawing | **react-native-svg** | SVG arcs for sectors; entire `<G>` rotates as one unit |
| Wheel animation | **react-native-reanimated** | Shared values → native thread; smooth 60 fps; same `easeOut(t) = 1-(1-t)^4` formula from `wheel.js` |
| Weight graph | **react-native-svg** | Same library; path + lines + text |
| Audio (tick) | **expo-av** | Bundle a short click `.wav`; play on each sector crossing |
| Settings | **AsyncStorage** (@react-native-async-storage) | Mirrors current `localStorage` usage |
| Date utils | **date-fns** | `parse`, `format`, `addDays`, `addMonths`, `differenceInDays` |

---

## Project Structure

```
todo-of-fortune-ios/
├── app.json                      (Expo config)
├── package.json
├── tsconfig.json
├── assets/
│   └── tick.wav                  (bundled click sound, ~25ms)
├── app/                          (Expo Router screens)
│   ├── _layout.tsx               (Stack navigator root)
│   ├── index.tsx                 (Home — energy input + Spin button)
│   ├── wheel.tsx                 (Wheel animation screen)
│   ├── result.tsx                (Selected task + actions)
│   ├── todos.tsx                 (Todo list with Add/Edit/Delete)
│   ├── add-todo.tsx              (Add/Edit todo form — modal)
│   ├── history.tsx               (History log)
│   └── settings.tsx              (Settings modal)
└── src/
    ├── db/
    │   ├── setup.ts              (CREATE TABLE statements + migration)
    │   ├── todos.ts              (loadTodos, saveTodo, deleteTodo)
    │   └── history.ts            (appendHistory, loadHistory)
    ├── logic/
    │   ├── probability.ts        (computeWeight — direct port of app.py)
    │   ├── dates.ts              (parseDate, formatDate, parseRate)
    │   └── spin.ts               (weightedRandomChoice)
    ├── components/
    │   ├── Wheel.tsx             (SVG wheel component)
    │   ├── WeightGraph.tsx       (SVG probability curve)
    │   └── HistoryItem.tsx       (single history row)
    └── constants/
        └── categories.ts         (CATEGORY_COLORS map, identical to wheel.js)
```

---

## Data Layer

### SQLite schema (`src/db/setup.ts`)

```sql
CREATE TABLE IF NOT EXISTS todos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  category      TEXT    NOT NULL DEFAULT '',
  reoccuring    INTEGER NOT NULL DEFAULT 0,  -- 0/1
  reoccuring_rate TEXT  DEFAULT '',          -- "1 week", "1 month", etc.
  last_done     TEXT    DEFAULT '',          -- "D/M/YYYY" or ''
  due_date      TEXT    DEFAULT '',          -- "D/M/YYYY" or ''
  effort        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT '',
  completion_date TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'done',  -- 'done' | 'skipped'
  effort          INTEGER
);
```

Seed data: on first launch, if `todos` table is empty, insert the current tasks from `todos.csv` as initial data (hardcoded array in `setup.ts`).

### CRUD helpers (`src/db/todos.ts`, `src/db/history.ts`)
Mirror the Python helper functions exactly:
- `loadTodos()` → `SELECT * FROM todos` (array of `Todo` objects)
- `saveTodo(todo)` → INSERT or UPDATE (upsert by id)
- `deleteTodo(id)` → DELETE
- `appendHistory(entry)` → INSERT INTO history
- `loadHistory()` → `SELECT * FROM history ORDER BY id DESC`

### TypeScript types
```ts
type Todo = {
  id: number;
  name: string;
  category: string;
  reoccuring: boolean;
  reoccuringRate: string;
  lastDone: string;
  dueDate: string;
  effort: number;
};

type HistoryEntry = {
  id: number;
  name: string;
  category: string;
  completionDate: string;
  status: 'done' | 'skipped';
  effort: number;
};
```

---

## Logic Layer (direct ports)

### `src/logic/dates.ts`
Port of `parse_date`, `format_date`, `parse_rate` using `date-fns`:
- `parseDate(s: string): Date | null` — split on `/`, reconstruct with `new Date(year, month-1, day)`
- `formatDate(d: Date): string` — `format(d, 'd/M/yyyy')`
- `parseRate(rateStr: string): number` — returns days; `"1 week"` → 7, `"2 week"` → 14, `"1 month"` → 30, `"3 month"` → 90

### `src/logic/probability.ts`
Direct port of `compute_weight` from `app.py`. Identical formula, identical edge cases. Input is a `Todo` object + `weightEffect: number`. Returns `number`.

### `src/logic/spin.ts`
```ts
function weightedRandomChoice<T>(items: T[], weights: number[]): T
```
Uses `Math.random()` and cumulative weight scan — equivalent to Python's `random.choices`.

---

## Screen-by-screen Plan

### `app/index.tsx` — Home
- Number input for energy (default 3, min 1)
- "Spin!" button
- On press: load todos from SQLite, run `computeWeight` on each, filter `weight > 0 && effort <= energy`, if none → alert "No tasks", else navigate to `wheel` screen passing `{ tasks, selected }` as params

### `app/wheel.tsx` — Wheel
- Receives `tasks` (filtered+weighted array) and `selected` (name of pre-chosen task) as route params
- Renders `<Wheel tasks={tasks} selectedName={selected} onDone={...} />`
- "Spinning…" label during animation, hidden after

### `app/result.tsx` — Result
- Receives `selectedTask` as route param
- Shows category badge, task name, effort, due date
- Three buttons: **Mark Complete** → `completeTodo()` + navigate home; **Not done yet** → `skipTodo()` + navigate home; **Spin Again** → navigate back to home

### `app/todos.tsx` — Todo List
- `FlatList` of all todos from SQLite
- Each row: name, category badge, effort, due date chip
- Swipe-to-delete (React Native Gesture Handler)
- "+" FAB → navigate to `add-todo` (modal)
- Tap row → navigate to `add-todo` pre-filled with that task (edit mode)

### `app/add-todo.tsx` — Add/Edit Modal
Form fields (all controlled TextInput/Picker/Switch):
- Name (TextInput)
- Category (Picker: household / science / hobbies / admin / coding + custom text fallback)
- Effort (numeric TextInput, 1–10)
- Recurring (Switch)
- Recurring rate (shown only when recurring=true; Picker: daily / weekly / biweekly / monthly / quarterly / every 3 months)
- Due date (DateTimePicker from `@react-native-community/datetimepicker`, optional)
- Save / Cancel buttons

On save: INSERT or UPDATE todo in SQLite.

### `app/history.tsx` — History
- `FlatList` of `HistoryEntry` from SQLite, newest first
- Each row: name, category badge, status pill (done=green / skipped=gray), date, effort
- Back button → navigate home
- Empty state text

### `app/settings.tsx` — Settings
- Spin duration slider (1–15s)
- Due date effect slider (0–1, step 0.05)
- `<WeightGraph weightEffect={...} />` — live-updating SVG curve
- Values persisted to AsyncStorage on change
- Accessible from a gear icon button on the home screen header

---

## Wheel Component (`src/components/Wheel.tsx`)

### Rendering
Use `react-native-svg`:
```tsx
<Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
  <AnimatedG rotation={animatedDeg} origin={`${cx}, ${cy}`}>
    {tasks.map((task, i) => (
      <WheelSector key={task.name} task={task} index={i} total={tasks.length} cx={cx} cy={cy} r={r} />
    ))}
  </AnimatedG>
  {/* Centre cap */}
  <Circle cx={cx} cy={cy} r={20} fill="#0f0f1a" />
</Svg>
```

Each `<WheelSector>` renders:
- `<Path>` for the filled arc (SVG arc commands: `M cx cy L startX startY A r r 0 largeArcFlag 1 endX endY Z`)
- `<Text>` label rotated to the sector midpoint
- `largeArcFlag` is `sliceAngle > π ? 1 : 0`

All segments are equal angle (`2π / tasks.length`), matching current behaviour.

### Animation
Use `react-native-reanimated`:
```ts
const rotation = useSharedValue(lastRotation);

rotation.value = withTiming(targetDeg, {
  duration: spinDuration * 1000,
  easing: Easing.out(Easing.poly(4)), // matches (1-(1-t)^4)
}, onDone);
```

### Tick sound
Via `useAnimatedReaction`: when the pointer crosses a sector boundary (`|rotation - lastTick| >= 360/tasks.length`), call `playTick()` via `runOnJS`.

### Pointer
Absolutely positioned `▼` above the SVG with `marginBottom: -14` overlap.

---

## WeightGraph Component (`src/components/WeightGraph.tsx`)

Use `react-native-svg` to reproduce `drawWeightGraph` from `wheel.js`:
- `<Rect>` background
- `<Line>` horizontal gridlines (y=1,2,3,4)
- `<Line>` dashed vertical marker at x=0 (due date) and horizontal baseline at weight=1
- `<Path>` filled + stroked curve (sample `computeWeight` for d in −8..34 at 0.25-day intervals)
- `<Text>` axis labels

Updates on every `weightEffect` prop change.

---

## Audio

Bundle `assets/tick.wav` (~25ms click). Play via:
```ts
const { sound } = await Audio.Sound.createAsync(require('../assets/tick.wav'));
await sound.playAsync();
```

---

## Dependencies to install
```
expo-sqlite
@react-native-async-storage/async-storage
react-native-svg
react-native-reanimated
react-native-gesture-handler
expo-av
@react-native-community/datetimepicker
date-fns
```

---

## Verification
1. `npx expo start` → scan QR with Expo Go on iPhone
2. Home: enter energy=3, tap Spin — wheel animates, lands on a task
3. Mark Complete on a non-recurring task → gone from todo list, appears in history as "done"
4. Mark Complete on a recurring task → `last_done` and `due_date` updated, stays in todos, appears in history
5. "Not done yet" → task stays in todos, appears in history as "skipped"
6. Add a new todo (recurring weekly, effort 2) → appears in wheel on next spin
7. Settings: weight effect = 0 → graph shows flat line; overdue task on wheel but not boosted
8. Settings: change spin duration → wheel spins for correct duration
9. Kill and reopen app → all todos and history still present (SQLite persistence)
