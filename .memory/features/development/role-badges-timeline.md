# Role Badges in Timeline

User names in timeline comments and activities display role badges (e.g., "Buyer", "Trader", "Admin") next to the name, with colors matching the role-based card coloring system from `useRoleColors`. 

- **Primary activity cards** (comments, questions, answers): Show full role badge with label after the user name
- **Compact activity rows** (status changes, uploads, etc.): Show a small colored dot before the user's first name representing their primary role
- **Created card activity**: Shows role badge after the creator's full name

Roles are fetched from `user_roles` table alongside profile data when loading activities.
