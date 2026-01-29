

## Fix: "Unknown" Users in Development Card Timeline

### Problem

When viewing development cards from another user's session, people appear as "Someone" or "Unknown" instead of their actual names (like "Caio Kohn"). This happens because the current database security rules only allow:
1. Users to see their own profile
2. Admins to see all profiles

So when Peter (a trader) views a card created by Caio (a buyer/admin), Peter cannot read Caio's profile from the database, resulting in "Unknown" being displayed.

### Solution

Add a security policy that allows all logged-in users to view basic profile information (name and email) of other users. This is safe because:
- Profiles only contain display information (name, email, avatar URL)
- This data is already visible in the UI when viewing comments and activities
- No sensitive information is exposed

### What Will Change

| Before | After |
|--------|-------|
| Non-admins see "Unknown" or "Someone" for other users | Everyone sees the actual user names |
| Only admins and self can view profiles | All logged-in users can view all profiles |

### Technical Implementation

**Database Migration:**

```sql
-- Allow all authenticated users to view profiles
-- This enables displaying user names in activity timelines, comments, etc.
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
```

### Files to Modify

| Location | Change |
|----------|--------|
| Database (migration) | Add new RLS policy for authenticated users to SELECT from profiles |

### Security Considerations

- Only SELECT access is granted (no INSERT/UPDATE/DELETE)
- Only authenticated users can access (not anonymous)
- The `profiles` table only contains display information, not sensitive data
- This pattern is standard for multi-user applications where users need to see each other's names

### Expected Result

After this change:
- Peter will see "Caio Kohn commented" instead of "Unknown commented"
- All users will properly see who created cards, added comments, or performed actions
- The activity timeline will show correct names for all participants

