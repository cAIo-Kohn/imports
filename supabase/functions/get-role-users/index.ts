import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetRoleUsersRequest {
  roles: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: GetRoleUsersRequest = await req.json();
    const { roles } = body;

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return new Response(
        JSON.stringify({ userIds: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate roles against known roles
    const validRoles = ["admin", "buyer", "trader", "quality", "marketing", "viewer"];
    const filteredRoles = roles.filter(role => validRoles.includes(role));

    if (filteredRoles.length === 0) {
      return new Response(
        JSON.stringify({ userIds: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", filteredRoles);

    if (error) {
      console.error("Error fetching role users:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = [...new Set((data || []).map(r => r.user_id))];

    return new Response(
      JSON.stringify({ userIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in get-role-users:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
