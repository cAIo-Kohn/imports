import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductRow {
  estabelecimento: number;
  codigo: string;
  descricao: string;
  statusDeposito: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { products } = await req.json() as { products: ProductRow[] };

    if (!products || !Array.isArray(products)) {
      return new Response(
        JSON.stringify({ error: 'Products array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Importing ${products.length} product rows...`);

    // Fetch units mapping
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, name');

    if (unitsError) {
      console.error('Error fetching units:', unitsError);
      throw unitsError;
    }

    // Create mapping for estabelecimento -> unit_id
    const unitMapping: Record<number, string> = {};
    for (const unit of units || []) {
      if (unit.name === 'Matriz') unitMapping[1] = unit.id;
      if (unit.name === 'Filial Pernambuco') unitMapping[9] = unit.id;
      if (unit.name === 'Filial Rio de Janeiro') unitMapping[10] = unit.id;
    }

    console.log('Unit mapping:', unitMapping);

    // Group products by code
    const productsByCode: Record<string, { descricao: string; statusDeposito: string; estabelecimentos: number[] }> = {};
    
    for (const row of products) {
      const code = String(row.codigo).trim();
      if (!productsByCode[code]) {
        productsByCode[code] = {
          descricao: row.descricao,
          statusDeposito: row.statusDeposito,
          estabelecimentos: []
        };
      }
      if (!productsByCode[code].estabelecimentos.includes(row.estabelecimento)) {
        productsByCode[code].estabelecimentos.push(row.estabelecimento);
      }
    }

    const uniqueCodes = Object.keys(productsByCode);
    console.log(`Grouped into ${uniqueCodes.length} unique products`);

    // Fetch existing products in bulk
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, code')
      .in('code', uniqueCodes);

    if (fetchError) {
      console.error('Error fetching existing products:', fetchError);
      throw fetchError;
    }

    const existingProductsMap = new Map<string, string>();
    for (const p of existingProducts || []) {
      existingProductsMap.set(p.code, p.id);
    }

    console.log(`Found ${existingProductsMap.size} existing products`);

    // Separate new products from existing ones
    const newProducts: { code: string; technical_description: string; warehouse_status: string }[] = [];
    const productsToUpdate: { id: string; technical_description: string; warehouse_status: string }[] = [];

    for (const [code, data] of Object.entries(productsByCode)) {
      if (existingProductsMap.has(code)) {
        productsToUpdate.push({
          id: existingProductsMap.get(code)!,
          technical_description: data.descricao,
          warehouse_status: data.statusDeposito
        });
      } else {
        newProducts.push({
          code,
          technical_description: data.descricao,
          warehouse_status: data.statusDeposito
        });
      }
    }

    console.log(`Creating ${newProducts.length} new products, updating ${productsToUpdate.length} existing products`);

    let productsCreated = 0;
    let productsUpdated = 0;
    let unitsLinked = 0;
    const errors: string[] = [];

    // Batch insert new products (in chunks of 100)
    const BATCH_SIZE = 100;
    const newProductIds: Map<string, string> = new Map();

    for (let i = 0; i < newProducts.length; i += BATCH_SIZE) {
      const batch = newProducts.slice(i, i + BATCH_SIZE);
      const { data: insertedProducts, error: insertError } = await supabase
        .from('products')
        .insert(batch)
        .select('id, code');

      if (insertError) {
        console.error(`Error inserting batch ${i}:`, insertError);
        errors.push(`Error inserting batch: ${insertError.message}`);
      } else {
        for (const p of insertedProducts || []) {
          newProductIds.set(p.code, p.id);
        }
        productsCreated += (insertedProducts?.length || 0);
      }
    }

    console.log(`Inserted ${productsCreated} new products`);

    // Batch update existing products using upsert
    for (let i = 0; i < productsToUpdate.length; i += BATCH_SIZE) {
      const batch = productsToUpdate.slice(i, i + BATCH_SIZE);
      const { error: updateError } = await supabase
        .from('products')
        .upsert(batch.map(p => ({
          id: p.id,
          technical_description: p.technical_description,
          warehouse_status: p.warehouse_status
        })), { onConflict: 'id' });

      if (updateError) {
        console.error(`Error updating batch ${i}:`, updateError);
        errors.push(`Error updating products: ${updateError.message}`);
      } else {
        productsUpdated += batch.length;
      }
    }

    console.log(`Updated ${productsUpdated} products`);

    // Fetch existing product_units in batches to avoid URL length limits
    const allProductIds = [
      ...Array.from(existingProductsMap.values()),
      ...Array.from(newProductIds.values())
    ];

    const existingLinksSet = new Set<string>();
    const LINKS_BATCH_SIZE = 50; // Smaller batch to avoid URL limits

    console.log(`Fetching existing links for ${allProductIds.length} products in batches of ${LINKS_BATCH_SIZE}...`);

    for (let i = 0; i < allProductIds.length; i += LINKS_BATCH_SIZE) {
      const batch = allProductIds.slice(i, i + LINKS_BATCH_SIZE);
      const { data: links, error: linksError } = await supabase
        .from('product_units')
        .select('product_id, unit_id')
        .in('product_id', batch);

      if (linksError) {
        console.error(`Error fetching links batch ${i}:`, linksError);
        // Continue anyway - we'll use upsert to handle duplicates
      } else {
        for (const link of links || []) {
          existingLinksSet.add(`${link.product_id}-${link.unit_id}`);
        }
      }
    }

    console.log(`Found ${existingLinksSet.size} existing links`);

    // Prepare product_units to upsert
    const productUnitsToUpsert: { product_id: string; unit_id: string }[] = [];

    for (const [code, data] of Object.entries(productsByCode)) {
      const productId = existingProductsMap.get(code) || newProductIds.get(code);
      if (!productId) continue;

      for (const estabelecimento of data.estabelecimentos) {
        const unitId = unitMapping[estabelecimento];
        if (!unitId) continue;

        const linkKey = `${productId}-${unitId}`;
        if (!existingLinksSet.has(linkKey)) {
          productUnitsToUpsert.push({ product_id: productId, unit_id: unitId });
          existingLinksSet.add(linkKey); // Prevent duplicates in same batch
        }
      }
    }

    console.log(`Upserting ${productUnitsToUpsert.length} product-unit links`);

    // Batch upsert product_units with conflict handling
    for (let i = 0; i < productUnitsToUpsert.length; i += BATCH_SIZE) {
      const batch = productUnitsToUpsert.slice(i, i + BATCH_SIZE);
      const { error: linkError } = await supabase
        .from('product_units')
        .upsert(batch, { 
          onConflict: 'product_id,unit_id',
          ignoreDuplicates: true 
        });

      if (linkError) {
        // Only log if it's not a duplicate error
        if (!linkError.message.includes('duplicate') && !linkError.message.includes('unique')) {
          console.error(`Error upserting links batch ${i}:`, linkError);
          errors.push(`Error inserting links: ${linkError.message}`);
        }
      } else {
        unitsLinked += batch.length;
      }
    }

    console.log(`Linked ${unitsLinked} product-units`);

    const result = {
      success: true,
      productsCreated,
      productsUpdated,
      unitsLinked,
      totalProcessed: uniqueCodes.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    };

    console.log('Import completed:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in import-products function:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
