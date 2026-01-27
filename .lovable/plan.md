

## Plan: Units Management Page

### Overview

Implement a fully functional Units management page that displays existing units and allows creating new ones. A new `estabelecimento_code` column will be added to enable automatic recognition in file uploads.

---

### Current State

| Unit Name | City | State | Estabelecimento Code |
|-----------|------|-------|---------------------|
| Matriz | - | - | 1 (hardcoded) |
| Filial Pernambuco | Recife | PE | 9 (hardcoded) |
| Filial Rio de Janeiro | Rio de Janeiro | RJ | 10 (hardcoded) |

The `import-products` edge function has a **hardcoded mapping** that needs to be made dynamic.

---

### Database Changes

**Add new column to `units` table:**

```sql
ALTER TABLE public.units 
ADD COLUMN estabelecimento_code integer UNIQUE;

-- Populate existing units
UPDATE public.units SET estabelecimento_code = 1 WHERE name = 'Matriz';
UPDATE public.units SET estabelecimento_code = 9 WHERE name = 'Filial Pernambuco';
UPDATE public.units SET estabelecimento_code = 10 WHERE name = 'Filial Rio de Janeiro';
```

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/units/CreateUnitModal.tsx` | Modal form for creating new units |
| `src/components/units/EditUnitModal.tsx` | Modal form for editing existing units |
| `src/components/units/DeleteUnitDialog.tsx` | Confirmation dialog for deleting units |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Units.tsx` | Full implementation with data fetching, table, and modals |
| `supabase/functions/import-products/index.ts` | Replace hardcoded mapping with dynamic lookup using `estabelecimento_code` |

---

### Implementation Details

#### 1. Units Page (`src/pages/Units.tsx`)

**Features:**
- Fetch and display all units in a table
- Search by name, city, or state
- Show linked products count per unit
- "New Unit" button opens modal
- Click row to edit
- Delete button with confirmation

**Table Columns:**
| Column | Description |
|--------|-------------|
| Name | Unit name |
| Establishment Code | DATASUL code (1, 9, 10, etc.) |
| Location | City, State |
| Contact | Responsible name, email, phone |
| Products | Count of linked products |
| Status | Active/Inactive badge |
| Actions | Edit, Delete buttons |

#### 2. CreateUnitModal Component

**Form Fields:**
- Name (required)
- Estabelecimento Code (required, unique integer)
- CNPJ
- Address, City, State, ZIP Code
- Phone, Fax
- Responsible Name, Email, Phone

**Validation:**
- Name required
- Estabelecimento Code required and must be unique

#### 3. EditUnitModal Component

Similar to CreateUnitModal but pre-populated with existing data.

#### 4. DeleteUnitDialog Component

**Behavior:**
- Show warning if unit has linked products
- Prevent deletion if products are linked (or cascade delete links)
- Confirmation required

#### 5. Update import-products Edge Function

**Current (hardcoded):**
```typescript
const unitMapping: Record<number, string> = {};
for (const unit of units || []) {
  if (unit.name === 'Matriz') unitMapping[1] = unit.id;
  if (unit.name === 'Filial Pernambuco') unitMapping[9] = unit.id;
  if (unit.name === 'Filial Rio de Janeiro') unitMapping[10] = unit.id;
}
```

**New (dynamic):**
```typescript
const { data: units, error: unitsError } = await supabase
  .from('units')
  .select('id, name, estabelecimento_code');

const unitMapping: Record<number, string> = {};
for (const unit of units || []) {
  if (unit.estabelecimento_code) {
    unitMapping[unit.estabelecimento_code] = unit.id;
  }
}
```

This way, any new unit with an `estabelecimento_code` will automatically be recognized in product imports.

---

### Technical Section

#### Database Migration

```sql
-- Add estabelecimento_code column
ALTER TABLE public.units 
ADD COLUMN estabelecimento_code integer;

-- Add unique constraint
ALTER TABLE public.units
ADD CONSTRAINT units_estabelecimento_code_unique UNIQUE (estabelecimento_code);

-- Populate existing units with known codes
UPDATE public.units SET estabelecimento_code = 1 WHERE name = 'Matriz';
UPDATE public.units SET estabelecimento_code = 9 WHERE name = 'Filial Pernambuco';
UPDATE public.units SET estabelecimento_code = 10 WHERE name = 'Filial Rio de Janeiro';
```

#### CreateUnitModal Form Schema

```typescript
const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  estabelecimento_code: z.coerce.number().int().positive('Code must be positive'),
  cnpj: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  responsible_name: z.string().optional(),
  responsible_email: z.string().email().optional().or(z.literal('')),
  responsible_phone: z.string().optional(),
});
```

#### Units Query in Page

```typescript
const { data: units, isLoading, refetch } = useQuery({
  queryKey: ['units', search],
  queryFn: async () => {
    let query = supabase
      .from('units')
      .select('*')
      .order('name');

    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
});
```

#### Product Count per Unit

```typescript
const { data: productCounts } = useQuery({
  queryKey: ['unit-product-counts'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('product_units')
      .select('unit_id');
    
    if (error) throw error;
    
    const counts: Record<string, number> = {};
    for (const pu of data || []) {
      counts[pu.unit_id] = (counts[pu.unit_id] || 0) + 1;
    }
    return counts;
  }
});
```

---

### User Flow

1. **View Units**: User navigates to `/units` and sees table with existing units
2. **Create Unit**: Click "New Unit" → Fill form including estabelecimento code → Save
3. **Edit Unit**: Click row → Modal opens with data → Modify → Save
4. **Delete Unit**: Click delete icon → Confirmation dialog → Delete (if no linked products)
5. **Automatic Recognition**: When importing products, the `estabelecimento_code` in the file automatically matches the unit

---

### Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/Units.tsx` | Modify | Complete page implementation |
| `src/components/units/CreateUnitModal.tsx` | Create | Form modal for new units |
| `src/components/units/EditUnitModal.tsx` | Create | Form modal for editing units |
| `src/components/units/DeleteUnitDialog.tsx` | Create | Delete confirmation dialog |
| `supabase/functions/import-products/index.ts` | Modify | Dynamic unit mapping |

**Database migration:** Add `estabelecimento_code` column to `units` table

