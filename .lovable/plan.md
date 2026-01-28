
## Plan: Role-Based Card Colors with Admin Settings

### Overview

This feature adds:
1. **New roles**: Quality and Marketing (alongside Admin, Buyer, Trader, Viewer)
2. **Role-based card coloring**: Cards display a colored indicator based on who created them
3. **Filter by creator role** on the Development dashboard
4. **Admin color settings** in the Users page to customize colors per role

---

### Visual Design

**Card with Role Color Indicator:**
```text
┌───────────────────────────────────────────┐
│ ● Buyer                                   │  <- Small colored dot + role label
│ ┌─────────────────────────────────────┐   │
│ │  [Item] [Final] [Medium]            │   │
│ │  Card Title Here                    │   │
│ │  Supplier Name                      │   │
│ │  📦 2 samples   📅 28/01           │   │
│ └─────────────────────────────────────┘   │
└───────────────────────────────────────────┘
```

**Default Color Scheme:**
| Role | Color | Hex |
|------|-------|-----|
| Admin | Purple | #8B5CF6 |
| Buyer | Blue | #3B82F6 |
| Quality | Teal | #14B8A6 |
| Marketing | Pink | #EC4899 |
| Trader | Emerald | #10B981 |

---

### Database Changes

#### 1. Add New Roles to Enum

```sql
ALTER TYPE app_role ADD VALUE 'quality';
ALTER TYPE app_role ADD VALUE 'marketing';
```

#### 2. Create Role Card Colors Table

```sql
CREATE TABLE public.role_card_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL UNIQUE,
  color_hex TEXT NOT NULL DEFAULT '#6B7280',
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default colors
INSERT INTO public.role_card_colors (role, color_hex, label) VALUES
  ('admin', '#8B5CF6', 'Admin'),
  ('buyer', '#3B82F6', 'Buyer'),
  ('quality', '#14B8A6', 'Quality'),
  ('marketing', '#EC4899', 'Marketing'),
  ('trader', '#10B981', 'Trader'),
  ('viewer', '#6B7280', 'Viewer');

-- RLS: Admins can manage, everyone can read
ALTER TABLE public.role_card_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage role_card_colors"
  ON public.role_card_colors FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view role_card_colors"
  ON public.role_card_colors FOR SELECT
  USING (true);
```

---

### Frontend Implementation

#### 1. Update Type Definitions

**File: `src/hooks/useUserRole.ts`**
```typescript
export type AppRole = 'admin' | 'buyer' | 'quality' | 'marketing' | 'trader' | 'viewer';

// Add new role checks
const isQuality = hasRole('quality');
const isMarketing = hasRole('marketing');

return {
  // ... existing
  isQuality,
  isMarketing,
};
```

#### 2. Create Role Colors Hook

**New file: `src/hooks/useRoleColors.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from './useUserRole';

interface RoleColor {
  role: AppRole;
  color_hex: string;
  label: string;
}

const DEFAULT_COLORS: Record<string, { color_hex: string; label: string }> = {
  admin: { color_hex: '#8B5CF6', label: 'Admin' },
  buyer: { color_hex: '#3B82F6', label: 'Buyer' },
  quality: { color_hex: '#14B8A6', label: 'Quality' },
  marketing: { color_hex: '#EC4899', label: 'Marketing' },
  trader: { color_hex: '#10B981', label: 'Trader' },
  viewer: { color_hex: '#6B7280', label: 'Viewer' },
};

export function useRoleColors() {
  const { data: colors = [], isLoading } = useQuery({
    queryKey: ['role-card-colors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_card_colors')
        .select('*');
      if (error) throw error;
      return data as RoleColor[];
    },
  });

  const getColorForRole = (role: string | null): { color: string; label: string } => {
    const found = colors.find(c => c.role === role);
    if (found) return { color: found.color_hex, label: found.label };
    const defaultColor = DEFAULT_COLORS[role || ''];
    return defaultColor || { color: '#6B7280', label: 'Unknown' };
  };

  return { colors, isLoading, getColorForRole };
}
```

#### 3. Update DevelopmentCard Component

**File: `src/components/development/DevelopmentCard.tsx`**

Add a role indicator badge at the top of the card:

```typescript
import { useRoleColors } from '@/hooks/useRoleColors';

export function DevelopmentCard({ item, onClick, onDragStart, canDrag }: DevelopmentCardProps) {
  const { getColorForRole } = useRoleColors();
  
  // Get the creator's role color
  const creatorRole = (item as any).created_by_role;
  const { color, label } = getColorForRole(creatorRole);
  
  return (
    <div className={cn('...', highlightClass)}>
      {/* Creator Role Indicator */}
      {creatorRole && (
        <div className="flex items-center gap-1.5 mb-1">
          <span 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: color }}
          />
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
      )}
      
      {/* Rest of the card... */}
    </div>
  );
}
```

#### 4. Add Filter by Creator Role on Development Page

**File: `src/pages/Development.tsx`**

Add a new filter dropdown:

```typescript
const [creatorRoleFilter, setCreatorRoleFilter] = useState<string>('all');

// In the filters section:
<Select value={creatorRoleFilter} onValueChange={setCreatorRoleFilter}>
  <SelectTrigger className="w-[160px]">
    <SelectValue placeholder="Creator Role" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Departments</SelectItem>
    <SelectItem value="admin">Admin</SelectItem>
    <SelectItem value="buyer">Buyer</SelectItem>
    <SelectItem value="quality">Quality</SelectItem>
    <SelectItem value="marketing">Marketing</SelectItem>
    <SelectItem value="trader">Trader</SelectItem>
  </SelectContent>
</Select>

// Update filter logic:
const matchesCreatorRole = creatorRoleFilter === 'all' || 
  item.created_by_role === creatorRoleFilter;
```

#### 5. Add Card Colors Settings Section to Users Page

**File: `src/pages/Users.tsx`**

Add a new tab or section for managing card colors:

```typescript
// Add Tabs component to switch between Users and Card Colors
<Tabs defaultValue="users">
  <TabsList>
    <TabsTrigger value="users">Users</TabsTrigger>
    <TabsTrigger value="colors">Card Colors</TabsTrigger>
  </TabsList>
  
  <TabsContent value="users">
    {/* Existing users table */}
  </TabsContent>
  
  <TabsContent value="colors">
    <RoleColorsSettings />
  </TabsContent>
</Tabs>
```

#### 6. Create Role Colors Settings Component

**New file: `src/components/users/RoleColorsSettings.tsx`**

```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function RoleColorsSettings() {
  const queryClient = useQueryClient();
  
  const { data: colors = [], isLoading } = useQuery({
    queryKey: ['role-card-colors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_card_colors')
        .select('*')
        .order('role');
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ role, color_hex }: { role: string; color_hex: string }) => {
      const { error } = await supabase
        .from('role_card_colors')
        .update({ color_hex, updated_at: new Date().toISOString() })
        .eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-card-colors'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Colors by Department</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {colors.map((item) => (
            <div key={item.role} className="flex items-center gap-3 p-3 border rounded-lg">
              <input
                type="color"
                value={item.color_hex}
                onChange={(e) => updateMutation.mutate({ 
                  role: item.role, 
                  color_hex: e.target.value 
                })}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.color_hex}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 7. Update Role Selection in User Modals

**Files: `EditUserRoleModal.tsx`, `CreateUserModal.tsx`**

Add Quality and Marketing role options:

```typescript
const roleOptions = [
  { value: 'admin', label: 'Administrator', description: '...', icon: Shield },
  { value: 'buyer', label: 'Buyer', description: '...', icon: ShoppingCart },
  { value: 'quality', label: 'Quality', description: 'Quality assurance and control', icon: CheckCircle },
  { value: 'marketing', label: 'Marketing', description: 'Product marketing and branding', icon: Megaphone },
  { value: 'trader', label: 'Trader', description: '...', icon: TrendingUp },
  { value: 'viewer', label: 'Viewer', description: '...', icon: Eye },
];
```

---

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | Add roles to enum, create role_card_colors table |
| `src/hooks/useUserRole.ts` | Modify | Add quality/marketing type and helpers |
| `src/hooks/useRoleColors.ts` | Create | Hook to fetch and use role colors |
| `src/components/development/DevelopmentCard.tsx` | Modify | Add role color indicator |
| `src/pages/Development.tsx` | Modify | Add creator role filter |
| `src/pages/Users.tsx` | Modify | Add tabs for users/colors sections |
| `src/components/users/RoleColorsSettings.tsx` | Create | Admin color picker interface |
| `src/components/users/EditUserRoleModal.tsx` | Modify | Add Quality/Marketing options |
| `src/components/users/CreateUserModal.tsx` | Modify | Add Quality/Marketing options |

---

### Implementation Order

1. **Database migration**: Add enum values and create colors table
2. **Update useUserRole.ts**: Add new role types
3. **Create useRoleColors.ts**: Hook for fetching colors
4. **Update DevelopmentCard.tsx**: Add role indicator
5. **Update Development.tsx**: Add filter dropdown
6. **Create RoleColorsSettings.tsx**: Admin color picker
7. **Update Users.tsx**: Add tabs and integrate settings
8. **Update user modals**: Add new role options

---

### User Flow

1. **Admin creates user** -> Assigns roles including Quality/Marketing
2. **User creates card** -> `created_by_role` is set based on their primary role
3. **Card displays** -> Shows colored dot and role label
4. **Users filter** -> Can filter by department/role
5. **Admin adjusts colors** -> Goes to Users > Card Colors tab to customize

---

### Edge Cases

- **User with multiple roles**: Use first matching role in priority order (Admin > Buyer > Quality > Marketing > Trader > Viewer)
- **Legacy cards without `created_by_role`**: Show as "Unknown" with gray color
- **Color picker**: Uses native HTML color picker for simplicity
