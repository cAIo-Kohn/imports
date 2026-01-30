# Memory: features/development/banner-quick-actions
Updated: 2026-01-30

Timeline banners utilize a unified `BannerQuickActions` dropdown menu to consolidate secondary interactions. The dropdown includes:
- **New Thread**: Opens the `NewThreadComposer` component with a thread title field and unified message input
- **Add Comment**: Opens the inline composer for adding a comment (no card move)
- **Ask Question**: Opens the inline composer for asking a question (moves card + sets question pending)
- **Upload File**: Opens the file upload section
- **Request Sample**: (when applicable) Triggers sample request flow

High-priority contextual actions—such as 'Review Sample', 'Request Sample', or 'Mark Arrived'—and the `SnoozeButton` remain visible as standalone buttons for immediate access. The ActionsPanel also uses `NewThreadComposer` for its "New Thread" button.
