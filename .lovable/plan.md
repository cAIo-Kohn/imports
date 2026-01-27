

## Plan: Fix 8-Digit Product Code Recognition in Supplier Import

### Problem

The supplier invoice import at `/suppliers` fails to recognize product codes with 8 digits (like `40600101`). The current code only accepts 5-6 digit codes.

### Root Cause

In `src/components/suppliers/ImportSupplierInvoiceModal.tsx`:

**Line 176** - Regex validation is too restrictive:
```typescript
if (/^\d{5,6}$/.test(codeCell)) {  // ❌ Rejects 8-digit codes
```

**Line 184** - Normalization assumes 6 digits max:
```typescript
code: codeCell.padStart(6, '0'),  // ❌ Doesn't help 8-digit codes
```

### Database Verification

Products with 8-digit codes exist in the database:
- `40600101`, `40600103`, `40600104`, `40600121`, etc.

### Solution

Update the regex and normalization to support codes from 5-8 digits:

```typescript
// Line 176: Accept 5-8 digit codes
if (/^\d{5,8}$/.test(codeCell)) {
  
  // Line 184: Keep code as-is (no padding needed for 8-digit codes)
  code: codeCell,  // Remove padStart - use original code
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/suppliers/ImportSupplierInvoiceModal.tsx` | Update regex to accept 5-8 digits, remove unnecessary padding |

---

### Technical Details

**Before:**
```typescript
// Check if it looks like a product code (5-6 digits)
if (/^\d{5,6}$/.test(codeCell)) {
  // ...
  products.push({
    code: codeCell.padStart(6, '0'), // Normalize to 6 digits
    description: descCell,
    supplierSpecs: cleanedSpecs
  });
}
```

**After:**
```typescript
// Check if it looks like a product code (5-8 digits)
if (/^\d{5,8}$/.test(codeCell)) {
  // ...
  products.push({
    code: codeCell, // Keep original code format
    description: descCell,
    supplierSpecs: cleanedSpecs
  });
}
```

---

### Matching Logic

The existing matching logic uses `normalizeProductCode()` which removes leading zeros:

```typescript
function normalizeProductCode(code: string): string {
  return code.replace(/^0+/, '');
}
```

This will correctly match:
- File code `40600101` → normalized `40600101`
- DB code `40600101` → normalized `40600101` ✓
- File code `009071` → normalized `9071`
- DB code `9071` → normalized `9071` ✓

The normalization logic is already correct for 8-digit codes.

---

### Summary

A single file change with two line edits:
1. Expand regex from `{5,6}` to `{5,8}`
2. Remove `padStart(6, '0')` and use original code

