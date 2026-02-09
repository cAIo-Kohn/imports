

## Fix: Import Sales History to Support Your File Format

### Problem
The current import modal won't recognize your file because:
1. **Column name mismatch**: Your file uses `ITEM` as the header, but the code only looks for `codigo item`, `codigo produto`, `codigo`, `code`, `sku`. The word `item` alone is not matched.
2. Everything else (month header `Jan-26`, numeric values, leading zeros) should work correctly with the existing parser.

### Solution
A single, small change in `ImportSalesHistoryModal.tsx`:

**Add `'item'` to the list of recognized column names** in the `handleParseData` function (line 207):

```
Before: ['codigo item', 'codigo produto', 'codigo', 'code', 'sku']
After:  ['item', 'codigo item', 'codigo produto', 'codigo', 'code', 'sku']
```

That's it. Adding `'item'` to the front of the list ensures your file format is recognized immediately.

### Why nothing else needs to change
- **Month parsing**: `Jan-26` matches the existing regex `([a-zç]+)[\/\-\s]?(\d{2,4})` -- extracts "jan" (month 0) and "26" (year 2026). Works correctly.
- **Subtotal rows**: Rows with empty ITEM cells are already skipped (`if (!rawCode) continue`).
- **Leading zeros**: Product codes like `001000` are normalized by stripping leading zeros (`replace(/^0+/, '')`), matching the same normalization applied to DB product codes.
- **Numeric values**: Integer values like `18479` are parsed correctly by `parseNumericValue`.
- **Upsert logic**: Uses `onConflict: 'product_id,unit_id,year_month'` so re-uploading the same month overwrites previous data, which is the desired behavior for corrections.

### File to Modify
| File | Change |
|---|---|
| `src/components/planning/ImportSalesHistoryModal.tsx` | Add `'item'` to the recognized code column names array (line 207) |

