

## Fix Card Click to Open Side Drawer on New Products Page

### Problem
When clicking on an eligible product card in the "New Products" tab, it navigates to `/development?card={id}` instead of opening the card's detail drawer directly on the current page.

### Solution
Add the `ItemDetailDrawer` component to the `NewProducts` page and manage state locally, exactly like the Development page does. When a card is clicked, it will open the drawer in-place without navigating.

### Technical Changes

**File: `src/pages/NewProducts.tsx`**

1. **Add state management for selected item**:
   ```tsx
   const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
   ```

2. **Update `handleOpenCard` to set state instead of navigate**:
   ```tsx
   const handleOpenCard = (cardId: string) => {
     setSelectedItemId(cardId);
   };
   ```

3. **Fetch full item data for the drawer**:
   - Query `development_items` to get the selected item's full data when `selectedItemId` is set
   - Use the same data structure expected by `ItemDetailDrawer`

4. **Add ItemDetailDrawer component**:
   ```tsx
   <ItemDetailDrawer
     item={selectedItem || null}
     open={!!selectedItemId}
     onOpenChange={(open) => {
       if (!open) setSelectedItemId(null);
     }}
   />
   ```

5. **Import required components**:
   - `ItemDetailDrawer` from `@/components/development/ItemDetailDrawer`
   - `DevelopmentItem` type from `@/pages/Development`

### Files to Modify

1. `src/pages/NewProducts.tsx` - Add drawer state, fetch logic, and drawer component

