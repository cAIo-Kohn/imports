
Goal: Make `/development` fit the screen so you never need to horizontally scroll the whole page to reach “New Item” (and other top controls). Horizontal scroll should happen only inside the Kanban area.

What’s happening (root cause)
- Your `DashboardLayout` wraps every page inside: `div.flex-1 p-6 overflow-auto`
- Because it’s `overflow-auto`, when the Kanban content is wider than the viewport, the layout container itself becomes horizontally scrollable.
- Result: the entire page (including the header with “New Item”) shifts left/right. That’s why the button can become “off-screen”.

High-level fix
1) Prevent horizontal scrolling at the layout level (keep only vertical scrolling there).
2) Ensure `/development` (and the Kanban board) can shrink inside flex layouts by using `min-w-0` in the right places.
3) Keep horizontal scrolling inside the Kanban’s ScrollArea only.

Changes to implement

A) Update the global layout to block horizontal scroll
File: `src/components/layout/DashboardLayout.tsx`

- Change the children wrapper from:
  - `className="flex-1 p-6 overflow-auto"`
- To:
  - `className="flex-1 p-6 overflow-y-auto overflow-x-hidden min-w-0"`

- Also add `min-w-0` to the `<main>` container so wide children don’t force the whole main area wider than the viewport:
  - `className="flex-1 flex flex-col min-w-0"`

Why this works
- `overflow-x-hidden` ensures the page container cannot scroll sideways.
- `min-w-0` allows flex children to shrink instead of forcing layout overflow (this is a common “why is my flex layout causing horizontal scroll?” fix).

B) Adjust `/development` wrapper so it doesn’t create left overflow
File: `src/pages/Development.tsx`

- Remove the negative margin hack `-m-6` (it can cause content to extend to the left, and with layout overflow rules it can become clipped or create weird “wide to the left” behavior).
- Replace with a safe flex layout that:
  - stays full width
  - prevents the page itself from scrolling horizontally
  - allows the Kanban region to handle its own scroll

Proposed structure:
- Outer wrapper: `className="flex flex-col h-full w-full min-w-0 overflow-hidden"`
- Header: `className="flex-shrink-0 ... w-full"`
- Kanban container: `className="flex-1 min-w-0 overflow-hidden"`

Optional improvement (if you want the header to remain visible while you scroll vertically inside the page):
- Make the header sticky: `sticky top-0 z-20` (only if needed; your current layout already keeps it visually separated).

C) Ensure Kanban scroll is contained and doesn’t “leak” to parents
File: `src/components/development/KanbanBoard.tsx`

- Ensure the ScrollArea root fills available width and is shrinkable:
  - `className="h-full w-full min-w-0"`
- Ensure the inner flex row is allowed to be wider than the viewport (so the ScrollArea is the scroller), without affecting parent width:
  - Add `w-max` to the inner container (the one that holds the columns)

Example direction:
- `<ScrollArea className="h-full w-full min-w-0">`
- Inner: `className="flex w-max ..."`

This makes the “big width” exist only inside the ScrollArea’s scrollable viewport instead of influencing layout width.

Verification / Testing checklist
1) Open `/development`:
   - “New Item” must be visible immediately without any horizontal page scroll.
   - Swiping/trackpad horizontal scroll should move the Kanban columns only.
2) Check other pages quickly (Products, Suppliers) to ensure:
   - Vertical scroll still works (it will).
   - Any wide tables still scroll horizontally inside their own containers (Products already uses `overflow-x-auto` around the table, so it should be fine).
3) Confirm there is no global horizontal scrollbar in the main dashboard content area.

Nice-to-have (optional, if you still feel it’s “1 mile” to navigate columns)
After the layout fix, if you still want faster navigation:
- Add a “Jump to column” dropdown in the header (Backlog, In Progress, …) that scrolls the Kanban to that column automatically.
- Add left/right arrow buttons to scroll one “screen width” at a time.
These reduce manual horizontal scrolling even inside the Kanban.

Files we’ll touch
- `src/components/layout/DashboardLayout.tsx` (stop layout-level horizontal scrolling)
- `src/pages/Development.tsx` (remove negative margin, add `min-w-0`/containment)
- `src/components/development/KanbanBoard.tsx` (ensure scroll containment with `w-full min-w-0` + `w-max`)

Expected outcome
- Header (including “New Item”) is always reachable and does not move sideways.
- Only the Kanban columns area scrolls horizontally, which is the intended behavior.
