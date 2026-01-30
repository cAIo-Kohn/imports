# Memory: features/development/unified-assignment-system
Updated: now

The card system has been refactored from team-based (MOR/ARC) ownership to user/role-based assignment. Key changes:

1. **Card Assignment**: Every card must be assigned to specific users or a department role at creation time. The `assigned_to_users` (UUID[]) and `assigned_to_role` (TEXT) columns on `development_items` store this.

2. **Original Thread**: When a card is created, an automatic `card_created` activity is inserted as the "original thread" root. This thread has the card's title and uses the same assignment. Users can reply directly to this thread without creating new ones.

3. **Dashboard Layout**: The MOR/ARC two-column view is replaced with "My Pending" (cards assigned to current user/role) and "All Cards" sections.

4. **Quick Actions**: Banners now differentiate between:
   - New Thread: Creates a separate new discussion thread
   - Add Comment: Replies to the original thread (no assignment change)
   - Ask Question: Replies to original thread and reassigns to card creator
   - Upload: Treated as comment attachment on original thread

5. **Legacy Compatibility**: The `current_owner` column is kept for backward compatibility but is no longer the primary assignment mechanism.
