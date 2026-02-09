

## Fix: XLSX Parsing Date Headers as Serial Numbers

### Problem
When XLSX reads your file, it interprets column headers like `Jan-26` as Excel date values and converts them to serial numbers (e.g., `46052`). The `parseMonthHeader` function then receives `"46052"` instead of `"Jan-26"`, finds zero month columns, and shows a toast "Nenhuma coluna de mes encontrada" -- which is easy to miss.

### Root Cause
Line 167: `XLSX.read(buffer, { type: 'array' })` parses dates automatically.
Line 170: `sheet_to_json` returns the parsed date serial numbers, not the original text.

### Solution
Two changes in `src/components/planning/ImportSalesHistoryModal.tsx`:

**1. Read with `raw: true` to prevent date parsing on headers**

Update `processFile` to read the sheet with raw values, then extract headers as the original cell strings:

```typescript
const workbook = XLSX.read(buffer, { type: 'array', raw: false });
const sheet = workbook.Sheets[sheetName];

// Get raw header strings using the sheet range
const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
const rawHeaders: string[] = [];
for (let c = range.s.c; c <= range.e.c; c++) {
  const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
  rawHeaders.push(cell ? XLSX.utils.format_cell(cell) : '');
}
```

This ensures `Jan-26` stays as the string `"Jan-26"` rather than becoming a serial number.

**2. Add fallback: parse Excel date serial numbers in `parseMonthHeader`**

As a safety net, if the regex doesn't match, try interpreting the header as an Excel date serial number:

```typescript
// Fallback: try parsing as Excel date serial number
const num = parseFloat(normalized);
if (!isNaN(num) && num > 1000) {
  const excelDate = XLSX.SSF.parse_date_code(num);
  if (excelDate) {
    return new Date(excelDate.y, excelDate.m - 1, 1);
  }
}
```

### File to Modify
| File | Change |
|---|---|
| `src/components/planning/ImportSalesHistoryModal.tsx` | Fix header extraction to preserve original text; add serial number fallback in `parseMonthHeader` |

### Why this fixes the "nothing happens" symptom
The toast "Nenhuma coluna de mes encontrada" fires but may be missed if another toast is showing or the dialog is in focus. With this fix, `Jan-26` will be correctly recognized as January 2026, month columns will be detected, and the flow will proceed to the preview step.
