import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { identifier, password } = await req.json();
    if (!identifier || !password) {
      return new Response(JSON.stringify({ ok: false, reason: "missing_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, full_name, national_id, phone_number, password")
      .or(`national_id.eq.${identifier},phone_number.eq.${identifier}`)
      .maybeSingle();

    if (error) throw error;

    if (!customer) {
      return new Response(JSON.stringify({ ok: false, reason: "not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (customer.password !== password) {
      return new Response(JSON.stringify({ ok: false, reason: "bad_password" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, customer: { id: customer.id, full_name: customer.full_name } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: "server_error", detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
