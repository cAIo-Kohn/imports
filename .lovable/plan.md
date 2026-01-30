# @Mentions & Notifications System

## Summary
Implemented a complete @mentions system that allows users to tag specific team members in comments and questions, creating real-time notifications.

## Components Created

### Database
- **`notifications` table**: Stores all notification types (mentions, questions, etc.) with fields for user_id, type, card_id, activity_id, triggered_by, title, content, is_read, read_at, created_at
- RLS policies for user-specific access
- Realtime enabled for instant notifications

### Hooks
- **`useNotifications.ts`**: Hook for fetching, managing, and subscribing to notifications in realtime. Includes `parseMentions`, `createMentionNotifications`, and `formatMentionsForDisplay` utilities.

### UI Components
- **`MentionInput.tsx`**: Text input with @mention autocomplete dropdown. Shows filtered user suggestions as you type after `@`. Supports keyboard navigation.
- **`MentionText.tsx`**: Component to render text with highlighted @mentions (blue background + text-primary).
- **`NotificationCenter.tsx`**: Bell icon with unread badge and dropdown showing all notifications. Supports mark as read, mark all read, and delete actions.

## Integration Points
- **AppSidebar**: NotificationCenter added to header
- **ActionsPanel**: Comment/Question inputs use MentionInput and create notifications on submit
- **InlineReplyBox**: Reply inputs use MentionInput and create notifications
- **HistoryTimeline**: Activity content rendered with MentionText for highlighted mentions

## How It Works
1. User types `@` in any comment/question field
2. Dropdown appears with matching team members (filtered by name/email)
3. User selects or navigates with arrow keys → mention inserted as `@[Name](user_id)`
4. On submit, `createMentionNotifications()` parses mentions and creates notification records
5. Mentioned users see a badge count on the bell icon
6. Clicking notification navigates to the relevant card
7. Realtime subscription ensures instant updates

## Mention Format
- **Storage**: `@[John Doe](uuid)` - allows parsing user ID
- **Display**: `@John Doe` with blue highlight


