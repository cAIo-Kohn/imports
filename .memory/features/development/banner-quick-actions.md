# Memory: features/development/banner-quick-actions
Updated: 2026-01-30

Timeline banners utilize a unified `BannerQuickActions` dropdown menu to consolidate secondary interactions. The "New Thread" action now opens the `NewThreadComposer` component, which includes a thread title field and unified message input where users can choose to post as "Comment" (no card move) or "Ask [Team]" (moves card + sets question pending). High-priority contextual actions—such as 'Review Sample', 'Request Sample', or 'Mark Arrived'—and the `SnoozeButton` remain visible as standalone buttons for immediate access. The ActionsPanel also uses `NewThreadComposer` for its "New Thread" button.
