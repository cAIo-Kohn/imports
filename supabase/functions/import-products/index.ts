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

    console.log(`Grouped into ${Object.keys(productsByCode).length} unique products`);

    let productsCreated = 0;
    let productsUpdated = 0;
    let unitsLinked = 0;
    const errors: string[] = [];

    for (const [code, data] of Object.entries(productsByCode)) {
      try {
        // Check if product already exists
        const { data: existingProduct, error: selectError } = await supabase
          .from('products')
          .select('id')
          .eq('code', code)
          .maybeSingle();

        if (selectError) {
          console.error(`Error checking product ${code}:`, selectError);
          errors.push(`Error checking product ${code}: ${selectError.message}`);
          continue;
        }

        let productId: string;

        if (existingProduct) {
          // Update existing product
          const { error: updateError } = await supabase
            .from('products')
            .update({
              technical_description: data.descricao,
              warehouse_status: data.statusDeposito
            })
            .eq('id', existingProduct.id);

          if (updateError) {
            console.error(`Error updating product ${code}:`, updateError);
            errors.push(`Error updating product ${code}: ${updateError.message}`);
            continue;
          }

          productId = existingProduct.id;
          productsUpdated++;
        } else {
          // Create new product
          const { data: newProduct, error: insertError } = await supabase
            .from('products')
            .insert({
              code: code,
              technical_description: data.descricao,
              warehouse_status: data.statusDeposito
            })
            .select('id')
            .single();

          if (insertError) {
            console.error(`Error creating product ${code}:`, insertError);
            errors.push(`Error creating product ${code}: ${insertError.message}`);
            continue;
          }

          productId = newProduct.id;
          productsCreated++;
        }

        // Link product to units
        for (const estabelecimento of data.estabelecimentos) {
          const unitId = unitMapping[estabelecimento];
          if (!unitId) {
            console.warn(`No unit found for estabelecimento ${estabelecimento}`);
            continue;
          }

          // Check if link already exists
          const { data: existingLink } = await supabase
            .from('product_units')
            .select('id')
            .eq('product_id', productId)
            .eq('unit_id', unitId)
            .maybeSingle();

          if (!existingLink) {
            const { error: linkError } = await supabase
              .from('product_units')
              .insert({
                product_id: productId,
                unit_id: unitId
              });

            if (linkError) {
              console.error(`Error linking product ${code} to unit ${estabelecimento}:`, linkError);
              errors.push(`Error linking product ${code} to unit ${estabelecimento}: ${linkError.message}`);
            } else {
              unitsLinked++;
            }
          }
        }
      } catch (err) {
        console.error(`Unexpected error processing product ${code}:`, err);
        errors.push(`Unexpected error processing product ${code}: ${String(err)}`);
      }
    }

    const result = {
      success: true,
      productsCreated,
      productsUpdated,
      unitsLinked,
      totalProcessed: Object.keys(productsByCode).length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Limit errors shown
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
