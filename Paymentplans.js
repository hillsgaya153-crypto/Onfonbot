import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
 
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
 
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
 
  try {
    const { customer_id } = await req.json();
    if (!customer_id) {
      return new Response(JSON.stringify({ ok: false, reason: "missing_customer_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
    const { data: loan, error: loanErr } = await supabase
      .from("loans")
      .select("plan_id, phone_uuid")
      .eq("customer_id", customer_id)
      .maybeSingle();
    if (loanErr) throw loanErr;
 
    if (!loan) {
      return new Response(JSON.stringify({ ok: false, reason: "no_loan" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
    const { data: plans, error } = await supabase
      .from("device_payment_plans")
      .select("id, repayment_months, daily_installment")
      .eq("phone_uuid", loan.phone_uuid)
      .order("repayment_months");
    if (error) throw error;
 
    const flatPlans = (plans ?? []).map(p => ({
      plan_id: p.id,
      repayment_months: p.repayment_months,
      daily_installment: p.daily_installment,
      is_current: p.id === loan.plan_id,
    }));
 
    return new Response(JSON.stringify({ ok: true, plans: flatPlans }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: "server_error", detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});