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
 
    const { data: loan, error } = await supabase
      .from("loans")
      .select(`
        id,
        principal_amount,
        balance_remaining,
        release_status,
        start_date,
        devices ( device_name ),
        device_payment_plans ( repayment_months )
      `)
      .eq("customer_id", customer_id)
      .maybeSingle();
 
    if (error) throw error;
 
    if (!loan) {
      return new Response(JSON.stringify({ ok: true, loan: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
    const { data: payments, error: payErr } = await supabase
      .from("loan_payments")
      .select("amount")
      .eq("loan_id", loan.id);
    if (payErr) throw payErr;
 
    const amount_paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
 
    const flatLoan = {
      id: loan.id,
      device_name: loan.devices?.device_name ?? "Unknown device",
      repayment_months: loan.device_payment_plans?.repayment_months ?? null,
      principal_amount: loan.principal_amount,
      balance_remaining: loan.balance_remaining,
      amount_paid,
      release_status: loan.release_status,
      start_date: loan.start_date,
    };
 
    return new Response(JSON.stringify({ ok: true, loan: flatLoan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: "server_error", detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
 