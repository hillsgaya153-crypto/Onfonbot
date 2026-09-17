import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
 
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
 
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
 
  try {
    const { customer_id, issue_description } = await req.json();
 
    if (!customer_id || !issue_description || !issue_description.trim()) {
      return new Response(JSON.stringify({ ok: false, reason: "missing_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
    const { data, error } = await supabase
      .from("support_requests")
      .insert({
        customer_id,
        issue_description: issue_description.trim(),
      })
      .select()
      .single();
 
    if (error) throw error;
 
    return new Response(JSON.stringify({ ok: true, request: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: "server_error", detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
 