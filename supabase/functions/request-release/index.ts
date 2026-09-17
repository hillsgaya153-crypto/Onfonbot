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
      .select("*, customers(full_name)")
      .eq("customer_id", customer_id)
      .maybeSingle();
    if (loanErr) throw loanErr;
    if (!loan) {
      return new Response(JSON.stringify({ ok: false, reason: "no_loan" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Number(loan.balance_remaining) > 0) {
      return new Response(
        JSON.stringify({ ok: false, reason: "balance_not_cleared", balance_remaining: loan.balance_remaining }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (loan.release_status === "pending") {
      return new Response(JSON.stringify({ ok: false, reason: "already_pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (loan.release_status === "released") {
      return new Response(JSON.stringify({ ok: false, reason: "already_released" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateErr } = await supabase
      .from("loans")
      .update({ release_status: "pending" })
      .eq("id", loan.id);
    if (updateErr) throw updateErr;

    const { error: insertErr } = await supabase.from("release_requests").insert({
      loan_id: loan.id,
      customer_id,
      customer_name: loan.customers?.full_name ?? "Unknown",
      device_name: loan.device_name,
      status: "pending",
    });
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: "server_error", detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
