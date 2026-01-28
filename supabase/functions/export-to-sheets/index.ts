import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert ArrayBuffer to base64url
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Convert string to base64url
function stringToBase64Url(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Parse PEM private key to CryptoKey
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

// Get Google Access Token using Service Account
async function getGoogleAccessToken(serviceAccountKey: string): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = stringToBase64Url(JSON.stringify(header));
  const encodedClaim = stringToBase64Url(JSON.stringify(claim));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  // Import the private key and sign
  const privateKey = await importPrivateKey(key.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = arrayBufferToBase64Url(signature);
  const jwt = `${signatureInput}.${encodedSignature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spreadsheetId, sheetName = 'Development Cards' } = await req.json();

    if (!spreadsheetId) {
      throw new Error('spreadsheetId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const googleServiceKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    if (!googleServiceKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all development cards with related data
    const { data: cards, error } = await supabase
      .from('development_items')
      .select(`*, supplier:suppliers(company_name)`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch sample counts
    const cardIds = cards?.map(card => card.id) || [];
    let sampleCounts: Record<string, number> = {};
    
    if (cardIds.length > 0) {
      const { data: samples } = await supabase
        .from('development_item_samples')
        .select('item_id')
        .in('item_id', cardIds);

      if (samples) {
        sampleCounts = samples.reduce((acc, s) => {
          acc[s.item_id] = (acc[s.item_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    // Format data for spreadsheet
    const headers = [
      'Card ID', 'Title', 'Description', 'Type', 'Category',
      'Status', 'Priority', 'Current Owner', 'Created By Role',
      'Supplier', 'FOB Price (USD)', 'MOQ', 'Qty/Container',
      'Container Type', 'Samples Count', 'Created At', 'Updated At', 'Is Solved', 'Is Deleted'
    ];

    const rows = (cards || []).map(card => [
      card.id,
      card.title,
      card.description || '',
      card.card_type || 'item',
      card.product_category || '',
      card.status,
      card.priority || 'medium',
      card.current_owner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)',
      card.created_by_role || '',
      card.supplier?.company_name || '',
      card.fob_price_usd || '',
      card.moq || '',
      card.qty_per_container || '',
      card.container_type || '',
      sampleCounts[card.id] || 0,
      new Date(card.created_at).toLocaleDateString('en-US'),
      new Date(card.updated_at).toLocaleDateString('en-US'),
      card.is_solved ? 'Yes' : 'No',
      card.deleted_at ? 'Yes' : 'No'
    ]);

    // Get Google access token
    const accessToken = await getGoogleAccessToken(googleServiceKey);

    // First, clear the existing sheet data
    const clearResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:S:clear`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!clearResponse.ok) {
      console.log('Clear response status:', clearResponse.status);
      // Continue anyway, might be a new sheet
    }

    // Write new data to Google Sheets
    const sheetRange = `${sheetName}!A1:S${rows.length + 1}`;
    
    const writeResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetRange)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [headers, ...rows] }),
      }
    );

    if (!writeResponse.ok) {
      const errorText = await writeResponse.text();
      throw new Error(`Failed to write to Google Sheets: ${errorText}`);
    }

    const writeResult = await writeResponse.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        rowsExported: rows.length,
        updatedRange: writeResult.updatedRange 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
