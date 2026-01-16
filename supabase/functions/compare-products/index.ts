import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompareRequest {
  codes: string[];
}

interface CompareResponse {
  newProducts: string[];
  existingProducts: { code: string; description: string }[];
  removedProducts: { code: string; description: string }[];
  summary: {
    newCount: number;
    existingCount: number;
    removedCount: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { codes }: CompareRequest = await req.json();

    if (!codes || !Array.isArray(codes)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: codes array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Comparing ${codes.length} product codes from upload...`);

    // Fetch all existing products from the database
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('code, technical_description')
      .order('code');

    if (fetchError) {
      console.error('Error fetching existing products:', fetchError);
      throw fetchError;
    }

    const existingCodes = new Set(existingProducts?.map(p => p.code) || []);
    const uploadCodes = new Set(codes);

    // Products in upload but not in database (NEW)
    const newProducts: string[] = [];
    for (const code of codes) {
      if (!existingCodes.has(code)) {
        newProducts.push(code);
      }
    }

    // Products in both upload and database (EXISTING - will be updated)
    const existingMatches: { code: string; description: string }[] = [];
    for (const code of codes) {
      if (existingCodes.has(code)) {
        const product = existingProducts?.find(p => p.code === code);
        existingMatches.push({
          code,
          description: product?.technical_description || ''
        });
      }
    }

    // Products in database but not in upload (REMOVED from file)
    const removedProducts: { code: string; description: string }[] = [];
    for (const product of existingProducts || []) {
      if (!uploadCodes.has(product.code)) {
        removedProducts.push({
          code: product.code,
          description: product.technical_description || ''
        });
      }
    }

    const response: CompareResponse = {
      newProducts,
      existingProducts: existingMatches,
      removedProducts,
      summary: {
        newCount: newProducts.length,
        existingCount: existingMatches.length,
        removedCount: removedProducts.length
      }
    };

    console.log(`Comparison complete: ${response.summary.newCount} new, ${response.summary.existingCount} existing, ${response.summary.removedCount} not in file`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compare-products:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
