
## Plan: Export Development Cards to Google Sheets

### Overview

This feature creates a backup/sync mechanism that exports all development card data to your Google Spreadsheet, providing a summarized view of card information.

---

### Prerequisites (User Action Required)

Before implementation, you need to:

1. **Create a Google Cloud Service Account**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project (or use existing)
   - Enable the **Google Sheets API**
   - Create a Service Account and download the JSON key file

2. **Share the Spreadsheet with the Service Account**:
   - Copy the service account email (looks like `xxx@project-id.iam.gserviceaccount.com`)
   - Open your Google Sheet and share it with this email (Editor access)

3. **Provide the Service Account Key**:
   - You'll need to add the JSON key contents as a secret in Lovable

---

### Data to Export

The spreadsheet will contain a summary of all development cards:

| Column | Description |
|--------|-------------|
| Card ID | Unique identifier |
| Title | Card title |
| Description | Desired outcome |
| Type | item / item_group / task |
| Category | final_product / raw_material |
| Status | pending / in_progress / waiting / solved |
| Priority | low / medium / high / urgent |
| Current Owner | MOR (Brazil) / ARC (China) |
| Created By Role | Buyer / Trader / Admin / etc |
| Supplier | Supplier company name |
| FOB Price (USD) | Commercial data |
| MOQ | Minimum order quantity |
| Qty per Container | Logistics data |
| Container Type | 20ft / 40ft / 40hq |
| Samples Count | Number of samples |
| Created At | Creation date |
| Updated At | Last update date |
| Is Solved | Yes / No |
| Is Deleted | Yes / No |

---

### Technical Implementation

#### 1. Create Edge Function for Google Sheets Export

**New file: `supabase/functions/export-to-sheets/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Sheets API helper
async function getGoogleAccessToken(serviceAccountKey: string) {
  const key = JSON.parse(serviceAccountKey);
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  
  // Sign JWT and exchange for access token
  // ... (JWT signing logic)
  
  return accessToken;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spreadsheetId, sheetName = 'Development Cards' } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleServiceKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all development cards with related data
    const { data: cards, error } = await supabase
      .from('development_items')
      .select(`*, supplier:suppliers(company_name)`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format data for spreadsheet
    const headers = [
      'Card ID', 'Title', 'Description', 'Type', 'Category', 
      'Status', 'Priority', 'Current Owner', 'Created By Role',
      'Supplier', 'FOB Price (USD)', 'MOQ', 'Qty/Container', 
      'Container Type', 'Created At', 'Updated At', 'Is Solved', 'Is Deleted'
    ];

    const rows = cards.map(card => [
      card.id,
      card.title,
      card.description || '',
      card.card_type,
      card.product_category || '',
      card.status,
      card.priority,
      card.current_owner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)',
      card.created_by_role || '',
      card.supplier?.company_name || '',
      card.fob_price_usd || '',
      card.moq || '',
      card.qty_per_container || '',
      card.container_type || '',
      new Date(card.created_at).toLocaleDateString(),
      new Date(card.updated_at).toLocaleDateString(),
      card.is_solved ? 'Yes' : 'No',
      card.deleted_at ? 'Yes' : 'No'
    ]);

    // Get Google access token
    const accessToken = await getGoogleAccessToken(googleServiceKey);

    // Clear existing data and write new data
    const sheetRange = `${sheetName}!A1:R${rows.length + 1}`;
    
    // Write to Google Sheets
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [headers, ...rows] }),
      }
    );

    return new Response(
      JSON.stringify({ success: true, rowsExported: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

#### 2. Add Export Button to Development Page

**File: `src/pages/Development.tsx`**

Add an "Export to Sheets" button in the header:

```typescript
import { FileSpreadsheet } from 'lucide-react';

// In the header section:
<Button 
  variant="outline" 
  onClick={handleExportToSheets}
  disabled={isExporting}
>
  <FileSpreadsheet className="h-4 w-4 mr-2" />
  {isExporting ? 'Exporting...' : 'Export to Sheets'}
</Button>

const handleExportToSheets = async () => {
  setIsExporting(true);
  try {
    const response = await supabase.functions.invoke('export-to-sheets', {
      body: { 
        spreadsheetId: '1OKtCJQxnZgHUTxZVDrTaVS7Y8xbMTXaKAW-q_YzoA0U',
        sheetName: 'Development Cards'
      }
    });
    
    if (response.error) throw response.error;
    
    toast({
      title: 'Export Successful',
      description: `${response.data.rowsExported} cards exported to Google Sheets`,
    });
  } catch (error) {
    toast({
      title: 'Export Failed',
      description: String(error),
      variant: 'destructive',
    });
  } finally {
    setIsExporting(false);
  }
};
```

---

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/export-to-sheets/index.ts` | Create | Edge function for Google Sheets API |
| `src/pages/Development.tsx` | Modify | Add export button |
| Secret: `GOOGLE_SERVICE_ACCOUNT_KEY` | Add | Google Cloud credentials |

---

### Setup Steps

1. **You provide**: Google Cloud Service Account JSON key
2. **I implement**: Edge function + UI button
3. **You share**: The spreadsheet with the service account email
4. **Test**: Click "Export to Sheets" button

---

### Alternative: Manual Export (Simpler)

If setting up Google Cloud is too complex, I can implement a simpler **CSV download** feature that:
- Exports all card data to a CSV file
- You manually upload to Google Sheets

This requires no API setup but means manual upload each time.

---

### Questions for You

Before proceeding, please confirm:

1. **Do you want the full Google Sheets API integration** (requires Google Cloud setup) or **simple CSV export** (manual upload)?

2. **If Google Sheets API**: Do you already have a Google Cloud account, or would you like guidance on setting one up?

The spreadsheet ID from your URL is: `1OKtCJQxnZgHUTxZVDrTaVS7Y8xbMTXaKAW-q_YzoA0U`
