
# Fix Team Mention Notifications on Card UI

## Problem Summary
When you @mention a team (e.g., `@Trader Team`), the mention is stored with an ID like `team:buyer`, but:
1. The mention parsing regex only matches UUIDs, so team mentions are ignored
2. Even if parsed, the code tries to insert `team:buyer` as a `user_id`, which fails
3. No unresolved mention entries are created for team members
4. No notification tags appear on the card UI

## Root Cause Analysis

### Current Flow
```text
User types @Trader Team
       ↓
MentionInput stores: @[Trader Team](team:trader)
       ↓
parseMentionsFromText() - uses UUID regex [a-f0-9-]+
       ↓
❌ FAILS - "team:trader" doesn't match UUID pattern
       ↓
No mentions created, no tags shown
```

### Expected Flow
```text
User types @Trader Team
       ↓
MentionInput stores: @[Trader Team](team:trader)
       ↓
Parse mentions - detect "team:" prefix
       ↓
Expand team:trader → [user1_uuid, user2_uuid, ...]
       ↓
Create unresolved mention for each team member
       ↓
Card shows "@Trader Team" tag
```

---

## Solution

### 1. Update Mention Parsing (`useCardMentions.ts`)

Modify `parseMentionsFromText` to capture both user UUIDs and team identifiers:

```typescript
// Parse @mentions from text - format: @[Name](id)
// Returns { userIds: string[], teamIds: string[] }
export function parseMentionsFromText(text: string): { 
  userIds: string[]; 
  teamIds: string[] 
} {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const userIds: string[] = [];
  const teamIds: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    const id = match[2];
    if (id.startsWith('team:')) {
      teamIds.push(id);
    } else {
      userIds.push(id);
    }
  }
  
  return {
    userIds: [...new Set(userIds)],
    teamIds: [...new Set(teamIds)],
  };
}
```

### 2. Expand Teams to Users (`useCardMentions.ts`)

Create helper to fetch all users for a given team/role:

```typescript
// Extract role from team ID (e.g., "team:trader" → "trader")
function getRoleFromTeamId(teamId: string): string | null {
  const match = teamId.match(/^team:(\w+)$/);
  return match ? match[1] : null;
}

// Fetch all user IDs for given roles via edge function
async function expandTeamsToUserIds(
  teamIds: string[], 
  excludeUserId: string
): Promise<{ userIds: string[]; teamNames: string[] }> {
  if (teamIds.length === 0) return { userIds: [], teamNames: [] };
  
  const roles = teamIds.map(getRoleFromTeamId).filter(Boolean) as string[];
  const teamNames = teamIds.map(id => {
    const role = getRoleFromTeamId(id);
    return role ? `${role.charAt(0).toUpperCase() + role.slice(1)} Team` : id;
  });
  
  // Use edge function to fetch users (bypasses RLS on user_roles)
  const response = await supabase.functions.invoke('get-role-users', {
    body: { roles },
  });
  
  if (response.error) {
    console.error('Failed to expand teams:', response.error);
    return { userIds: [], teamNames: [] };
  }
  
  const userIds = (response.data?.userIds || [])
    .filter((id: string) => id !== excludeUserId);
  
  return { userIds, teamNames };
}
```

### 3. Create New Edge Function (`get-role-users`)

A simple edge function to fetch users by role (bypassing RLS):

```typescript
// supabase/functions/get-role-users/index.ts
Deno.serve(async (req) => {
  const { roles } = await req.json();
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", roles);
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  
  const userIds = [...new Set(data.map(r => r.user_id))];
  return new Response(JSON.stringify({ userIds }));
});
```

### 4. Update `createMentions` in Hook

Modify the mutation to handle both individual users and teams:

```typescript
const createMentionsMutation = useMutation({
  mutationFn: async ({
    activityId,
    mentionedUserIds,
    mentionedTeamIds,
  }: {
    activityId: string;
    mentionedUserIds: string[];
    mentionedTeamIds: string[];
  }) => {
    if (!user?.id) return;

    // Expand teams to user IDs
    const { userIds: teamUserIds } = await expandTeamsToUserIds(
      mentionedTeamIds, 
      user.id
    );
    
    // Combine individual mentions + team member mentions
    const allUserIds = [...new Set([
      ...mentionedUserIds.filter(id => id !== user.id),
      ...teamUserIds,
    ])];
    
    if (allUserIds.length === 0) return;

    const mentions = allUserIds.map(userId => ({
      card_id: cardId,
      mentioned_user_id: userId,
      mentioned_by_user_id: user.id,
      activity_id: activityId,
    }));

    await supabase.from('card_unresolved_mentions').insert(mentions);
  },
});
```

### 5. Update `ChatMessageInput.tsx`

Pass both user IDs and team IDs to the mention creation:

```typescript
// Create unresolved mention entries
const { userIds, teamIds } = parseMentionsFromText(messageContent);
if (userIds.length > 0 || teamIds.length > 0) {
  await createMentions({
    activityId: data.id,
    mentionedUserIds: userIds,
    mentionedTeamIds: teamIds,
  });
}
```

### 6. Update `createMentionNotifications` in `useNotifications.ts`

Also handle team mentions for the notification system:

```typescript
export async function createMentionNotifications({
  text,
  cardId,
  activityId,
  triggeredBy,
  cardTitle,
}: {...}): Promise<void> {
  const { userIds, teamIds } = parseMentionsFromText(text);
  
  // Handle direct user mentions
  const directUserIds = userIds.filter(id => id !== triggeredBy);
  
  // Handle team mentions via edge function
  let teamUserIds: string[] = [];
  if (teamIds.length > 0) {
    const roles = teamIds
      .map(id => id.replace('team:', ''))
      .filter(Boolean);
    
    const response = await supabase.functions.invoke('send-notification', {
      body: {
        recipientRole: roles[0], // For now, handle first team
        // ... other notification params
      },
    });
  }
  
  // Create notifications for direct mentions
  // (Team notifications handled by send-notification edge function)
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/get-role-users/index.ts` | Fetch users by role (bypasses RLS) |

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useCardMentions.ts` | Update parsing to handle teams, expand teams to users |
| `src/components/development/ChatMessageInput.tsx` | Pass team IDs to createMentions |
| `src/hooks/useNotifications.ts` | Update `parseMentions` and `createMentionNotifications` |

---

## Data Flow After Fix

```text
User types @Trader Team + @Carl
       ↓
MentionInput stores: @[Trader Team](team:trader) @[Carl](uuid-123)
       ↓
parseMentionsFromText() returns:
  { userIds: ["uuid-123"], teamIds: ["team:trader"] }
       ↓
expandTeamsToUserIds("team:trader") 
  → fetches all trader user IDs: ["trader-1", "trader-2"]
       ↓
createMentions() inserts into card_unresolved_mentions:
  - mentioned_user_id: "uuid-123" (Carl)
  - mentioned_user_id: "trader-1"
  - mentioned_user_id: "trader-2"
       ↓
Development.tsx query fetches unresolved mentions
       ↓
Card shows: [@Carl] [@Trader1] [@Trader2] tags
```

## Summary
The fix expands team mentions into individual user mentions, so each team member gets their own unresolved mention entry. This ensures:
- Each team member sees the mention tag on the card
- Each team member receives a notification
- The mention resolves when each individual responds
