import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CadastralData {
  code: string;
  technical_description?: string;
  ean_13?: string;
  dun_14?: string;
  ncm?: string;
  item_type?: string;
  origin_description?: string;
  qty_master_box?: number;
  master_box_length?: number;
  master_box_width?: number;
  master_box_height?: number;
  master_box_volume?: number;
  gross_weight?: number;
  weight_per_unit?: number;
  individual_length?: number;
  individual_width?: number;
  individual_height?: number;
  individual_weight?: number;
  packaging_type?: string;
  product_length?: number;
  product_width?: number;
  product_height?: number;
}

// Normalize code by padding with leading zeros if numeric and less than 6 digits
const normalizeCode = (code: string): string => {
  const cleaned = String(code || '').trim();
  if (/^\d+$/.test(cleaned) && cleaned.length < 6) {
    return cleaned.padStart(6, '0');
  }
  return cleaned;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { products } = await req.json() as { products: CadastralData[] };

    if (!products || !Array.isArray(products)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: products array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-cadastral-data] Processing ${products.length} products from Excel`);

    // Normalize codes from the request
    const normalizedProducts = products.map(p => ({
      ...p,
      code: normalizeCode(p.code)
    }));

    // Get all product codes from the normalized request
    const codes = normalizedProducts.map(p => p.code).filter(Boolean);
    
    // Fetch existing products from database
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, code')
      .in('code', codes);

    if (fetchError) {
      console.error('[import-cadastral-data] Error fetching existing products:', fetchError);
      throw fetchError;
    }

    console.log(`[import-cadastral-data] Found ${existingProducts?.length || 0} existing products in database`);

    // Create a map of code -> id for existing products
    const existingProductMap = new Map<string, string>();
    existingProducts?.forEach(p => {
      existingProductMap.set(p.code, p.id);
    });

    // Separate products into those that exist (to update) and those that don't (to ignore)
    const productsToUpdate: (CadastralData & { id: string })[] = [];
    const ignoredProducts: string[] = [];

    for (const product of normalizedProducts) {
      const existingId = existingProductMap.get(product.code);
      if (existingId) {
        productsToUpdate.push({ ...product, id: existingId });
      } else {
        ignoredProducts.push(product.code);
      }
    }

    console.log(`[import-cadastral-data] Products to update: ${productsToUpdate.length}, Products ignored: ${ignoredProducts.length}`);

    // Update products in batches
    const BATCH_SIZE = 50;
    let updatedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < productsToUpdate.length; i += BATCH_SIZE) {
      const batch = productsToUpdate.slice(i, i + BATCH_SIZE);
      
      const { error: upsertError } = await supabase
        .from('products')
        .upsert(
          batch.map(p => ({
            id: p.id,
            code: p.code,
            technical_description: p.technical_description,
            ean_13: p.ean_13 || null,
            dun_14: p.dun_14 || null,
            ncm: p.ncm || null,
            item_type: p.item_type || null,
            origin_description: p.origin_description || null,
            qty_master_box: p.qty_master_box || null,
            master_box_length: p.master_box_length || null,
            master_box_width: p.master_box_width || null,
            master_box_height: p.master_box_height || null,
            master_box_volume: p.master_box_volume || null,
            gross_weight: p.gross_weight || null,
            weight_per_unit: p.weight_per_unit || null,
            individual_length: p.individual_length || null,
            individual_width: p.individual_width || null,
            individual_height: p.individual_height || null,
            individual_weight: p.individual_weight || null,
            packaging_type: p.packaging_type || null,
            product_length: p.product_length || null,
            product_width: p.product_width || null,
            product_height: p.product_height || null,
          })),
          { onConflict: 'id' }
        );

      if (upsertError) {
        console.error(`[import-cadastral-data] Error updating batch ${i / BATCH_SIZE + 1}:`, upsertError);
        errors.push(`Batch ${i / BATCH_SIZE + 1}: ${upsertError.message}`);
      } else {
        updatedCount += batch.length;
      }

      console.log(`[import-cadastral-data] Processed batch ${i / BATCH_SIZE + 1}, updated: ${updatedCount}`);
    }

    const result = {
      success: true,
      updated: updatedCount,
      ignored: ignoredProducts.length,
      ignoredCodes: ignoredProducts.slice(0, 20), // Return first 20 ignored codes
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('[import-cadastral-data] Import completed:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[import-cadastral-data] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
