

## Plan: Auto-Format Numbers in Commercial Data Fields

### Summary

Add automatic number formatting with Brazilian locale (dots as thousands separators, comma for decimals) to the Commercial Data inputs. Numbers will be formatted as the user types, showing:
- **FOB Price**: `9.000,00` (with 2 decimal places)
- **MOQ / Qty per Container**: `90.000` (integers only)

---

### Technical Approach

The key challenge is that `<input type="number">` doesn't support visual formatting with dots and commas. The solution is to switch to `type="text"` inputs with custom formatting logic:

1. **Display formatted value** - Show `90.000` in the input
2. **Accept only digits** - Filter out non-numeric characters on input
3. **Store raw number** - Keep the actual numeric value for saving to DB
4. **Format on change** - Apply formatting as the user types

---

### Implementation Details

#### 1. Create Formatting Utility Functions

Add new utility functions to `src/lib/utils.ts`:

```typescript
/**
 * Format number with Brazilian locale (1.234,56)
 * @param value - The number or string to format
 * @param decimals - Number of decimal places (0 for integers)
 */
export function formatBrazilianNumber(value: number | string, decimals: number = 0): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

/**
 * Parse Brazilian formatted number back to raw number
 * "90.000" → 90000
 * "9.000,50" → 9000.50
 */
export function parseBrazilianNumber(formatted: string): number {
  if (!formatted) return 0;
  // Remove thousand separators (dots), replace comma with decimal point
  const cleaned = formatted.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}
```

---

#### 2. Update Commercial Data Inputs in ActionsPanel

**File:** `src/components/development/ActionsPanel.tsx`

Replace the current `type="number"` inputs with `type="text"` and add formatting handlers:

**FOB Price (with decimals):**
```typescript
const handleFobPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  // Allow digits, comma, and partial input
  let input = e.target.value;
  // Remove non-numeric except comma
  input = input.replace(/[^\d,]/g, '');
  // Only allow one comma
  const parts = input.split(',');
  if (parts.length > 2) input = parts[0] + ',' + parts.slice(1).join('');
  // Limit decimal places to 2
  if (parts[1]?.length > 2) input = parts[0] + ',' + parts[1].slice(0, 2);
  
  // Format with thousand separators
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formatted = parts.length > 1 ? `${integerPart},${parts[1]}` : integerPart;
  
  setLocalFobPrice(formatted);
};

<Input
  id="fob-price"
  type="text"
  inputMode="decimal"
  placeholder="0,00"
  value={localFobPrice}
  onChange={handleFobPriceChange}
  className="pl-6 h-8 text-sm"
/>
```

**MOQ / Qty per Container (integers only):**
```typescript
const handleIntegerChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
  // Remove all non-digits
  let digits = e.target.value.replace(/\D/g, '');
  // Format with thousand separators
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  setter(formatted);
};

<Input
  id="moq"
  type="text"
  inputMode="numeric"
  placeholder="0"
  value={localMoq}
  onChange={handleIntegerChange(setLocalMoq)}
  className="h-8 text-sm"
/>

<Input
  id="qty-container"
  type="text"
  inputMode="numeric"
  placeholder="0"
  value={localQtyPerContainer}
  onChange={handleIntegerChange(setLocalQtyPerContainer)}
  className="h-8 text-sm"
/>
```

---

#### 3. Update Save Mutation to Parse Formatted Values

The save mutation needs to convert formatted strings back to numbers:

```typescript
// In saveCommercialDataMutation
const fobValue = parseBrazilianNumber(localFobPrice);
const moqValue = parseBrazilianNumber(localMoq);
const qtyValue = parseBrazilianNumber(localQtyPerContainer);
```

---

#### 4. Initialize State with Formatted Values

When loading existing values, format them for display:

```typescript
const [localFobPrice, setLocalFobPrice] = useState(
  fobPriceUsd ? formatBrazilianNumber(fobPriceUsd, 2) : ''
);
const [localMoq, setLocalMoq] = useState(
  moq ? formatBrazilianNumber(moq, 0) : ''
);
const [localQtyPerContainer, setLocalQtyPerContainer] = useState(
  qtyPerContainer ? formatBrazilianNumber(qtyPerContainer, 0) : ''
);
```

---

### Visual Result

| Field | User types | Displayed |
|-------|------------|-----------|
| FOB Price | `9000,50` | `9.000,50` |
| MOQ | `90000` | `90.000` |
| Qty/Container | `3451` | `3.451` |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/utils.ts` | Add `formatBrazilianNumber` and `parseBrazilianNumber` functions |
| `src/components/development/ActionsPanel.tsx` | Update inputs to use text type with formatting handlers |

---

### Edge Cases

- **Empty input**: Returns empty string, not "0"
- **Pasting values**: Handles pasted numbers by stripping non-digits
- **Existing data**: Already-saved numbers are formatted on load
- **Mobile keyboards**: Uses `inputMode="numeric"` / `inputMode="decimal"` for proper mobile keyboards

