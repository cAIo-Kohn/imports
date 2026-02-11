

## Add Password Change for Users (Admin)

### What Changes
Add the ability for admins to change a user's password from the Edit User modal. Both the Create User and Edit User forms will require double password confirmation to prevent typos.

### Steps

**1. Create a new edge function `update-user-password`**
- New file: `supabase/functions/update-user-password/index.ts`
- Verifies the caller is an admin (same pattern as `create-user`)
- Uses `supabaseAdmin.auth.admin.updateUserById()` to change the password
- Accepts `{ userId, password }` in the request body

**2. Update `src/components/users/CreateUserModal.tsx`**
- Add a "Confirm password" field below the existing password field
- Validate that both passwords match before submitting
- Show an error toast if passwords don't match

**3. Update `src/components/users/EditUserRoleModal.tsx`**
- Add an optional "New Password" section with two fields (new password + confirm)
- If left empty, password is not changed (only roles are updated as before)
- If filled, call the new `update-user-password` edge function after updating roles
- Validate minimum 6 characters and that both fields match

### Technical Details

**Edge function (`update-user-password/index.ts`):**
- CORS headers, admin auth check (same pattern as existing functions)
- Uses `supabaseAdmin.auth.admin.updateUserById(userId, { password })` from the Supabase Admin API
- Validates password length server-side (min 6 chars)

**CreateUserModal changes:**
- Add `confirmPassword` state
- Add confirm password input field after the password field
- Add validation: `password !== confirmPassword` shows error toast
- Reset `confirmPassword` in `resetForm()`

**EditUserRoleModal changes:**
- Add `newPassword` and `confirmPassword` state variables
- Add collapsible "Change Password" section with two input fields
- In `handleSubmit`: if `newPassword` is filled, validate match and length, then call the edge function
- Reset password fields when modal opens/closes

**Config update (`supabase/config.toml`):**
- Add `[functions.update-user-password]` with `verify_jwt = false` (validated in code)
