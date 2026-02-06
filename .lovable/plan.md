

## Dashboard Redesign: Personalized Pending Actions View

### Overview
Replace the current Dashboard (generic stats and next steps) with a personalized view showing:
1. **Greeting**: "Hello [username]!" (e.g., "Hello Caio!")
2. **Pending Cards for Your Team**: Cards requiring action from the logged user's department

### Key Concept
The Dashboard will act as if the Department filter in "New Items & Samples" is always active for your team. Since you're an Admin who belongs to the Buyer team, you'll see all cards pending for the Buyer department.

### Technical Approach

#### 1. User Profile Greeting
- Fetch user's `full_name` from `profiles` table using `user.id`
- Display "Hello {firstName}!" at the top

#### 2. Determine User's Functional Department
- Use `useUserRole()` hook to get user's roles
- Priority logic for department:
  - If `isBuyer` → department = 'buyer'
  - If `isQuality` → department = 'quality'
  - If `isMarketing` → department = 'marketing'
  - If `isTrader` → department = 'trader'
  - If only `isAdmin` → default to 'buyer' (admin belongs to buyer team per your requirement)

#### 3. Fetch & Filter Cards (Reuse Development.tsx Logic)
Cards are "pending for your team" if they match ANY of these criteria:
1. **Action Notifications**: `current_assignee_role` matches your department
2. **Unresolved Mentions**: Someone in your department has an unresolved @mention
3. **Created by Department**: Card was created by someone in your department

Additionally, only show cards where `derived_status !== 'solved'` and `deleted_at IS NULL`.

#### 4. UI Layout
```text
┌──────────────────────────────────────────────────────┐
│  Hello Caio!                                         │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  🛒 Your Team's Pending Cards (Buyer)     [12] │ │
│  │                                                 │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐          │ │
│  │  │ Card 1  │ │ Card 2  │ │ Card 3  │  ...     │ │
│  │  └─────────┘ └─────────┘ └─────────┘          │ │
│  │                                                 │ │
│  │  (Empty state: "No pending actions for your    │ │
│  │   team. Check New Items & Samples for all      │ │
│  │   ongoing cards.")                              │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  💡 To see all ongoing cards, go to                 │
│     New Items & Samples tab                         │
└──────────────────────────────────────────────────────┘
```

### Files to Modify

**1. `src/pages/Dashboard.tsx`** - Complete rewrite:
- Remove all current content (stats, next steps, purchase orders card)
- Add profile query to fetch user's full_name
- Add development items query (same as Development.tsx)
- Add user roles query for department filtering
- Implement department filtering logic
- Render cards using `DevelopmentCard` component
- Add `ItemDetailDrawer` for card click interaction
- Add empty state with link to New Items & Samples

### Components to Reuse
- `DevelopmentCard` - for rendering individual cards
- `ItemDetailDrawer` - for card detail view
- `useUserRole` hook - for department detection
- `useAuth` hook - for user ID

### Data Flow
1. Fetch user profile → Extract first name for greeting
2. Fetch development items with enrichment (samples, mentions, etc.)
3. Fetch all user roles → Build userRolesMap for mention filtering
4. Apply department filter (always on for user's team)
5. Render filtered cards in a grid layout

