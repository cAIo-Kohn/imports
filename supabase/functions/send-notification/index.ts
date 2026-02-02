import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  recipientUserIds?: string[];
  recipientRole?: string;
  triggeredBy: string;
  cardId: string;
  taskId?: string;
  activityId?: string;
  type: string;
  title: string;
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role to bypass RLS for role lookups
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: NotificationRequest = await req.json();
    const {
      recipientUserIds = [],
      recipientRole,
      triggeredBy,
      cardId,
      taskId,
      activityId,
      type,
      title,
      content,
    } = body;

    let userIds = [...recipientUserIds];

    // If assigned to role, get all users with that role (privileged lookup)
    if (recipientRole && userIds.length === 0) {
      const validRoles = ["admin", "buyer", "trader", "quality", "marketing", "viewer"];
      
      if (validRoles.includes(recipientRole)) {
        const { data: roleUsers, error: roleError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", recipientRole);
        
        if (roleError) {
          console.error("Error fetching role users:", roleError);
        } else if (roleUsers) {
          userIds = roleUsers.map((r) => r.user_id);
        }
      }
    }

    // Filter out the triggering user (don't notify yourself)
    userIds = userIds.filter((id) => id !== triggeredBy);

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No recipients to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get triggering user's name for the notification title
    const { data: triggerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", triggeredBy)
      .single();

    const triggerName = triggerProfile?.full_name || "Someone";
    const formattedTitle = title.replace("{name}", triggerName);

    // Create notifications for all recipients
    const notifications = userIds.map((userId) => ({
      user_id: userId,
      type,
      card_id: cardId,
      activity_id: activityId || taskId,
      triggered_by: triggeredBy,
      title: formattedTitle,
      content,
    }));

    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Error inserting notifications:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifiedCount: userIds.length,
        message: `Notified ${userIds.length} user(s)` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
