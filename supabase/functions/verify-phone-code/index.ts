import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    console.log("Verifying code for phone:", phone);

    if (!phone || !code) {
      return new Response(JSON.stringify({ error: "Phone number and code are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔧 NORMALIZAR NÚMERO A FORMATO E.164
    let normalizedPhone = phone.toString().trim();

    // Si no empieza con +, asumimos España (+34)
    if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = `+34${normalizedPhone.replace(/^0+/, "")}`;
    }

    console.log("Normalized phone:", normalizedPhone);

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const verifyServiceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

    if (!accountSid || !authToken || !verifyServiceSid) {
      console.error("Missing Twilio credentials");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Twilio Verify API
    const twilioUrl = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: normalizedPhone, // <--- ✔ AQUÍ SE USA EL NÚMERO CORREGIDO
        Code: code,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio API error:", data);
      return new Response(JSON.stringify({ error: data.message || "Failed to verify code" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Verification check status:", data.status);

    return new Response(
      JSON.stringify({
        success: data.status === "approved",
        status: data.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error verifying code:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to verify code" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
