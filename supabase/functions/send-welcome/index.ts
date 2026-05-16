import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const APP_URL = "https://athletehub-seven.vercel.app"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { full_name, email, club_name, club_logo_url } = await req.json()

    const welcomeHtml = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#004F4F,#008080);padding:28px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#FFFCF6;margin:0;font-size:22px;">Welcome to Apex Track</h1>
        <p style="color:rgba(255,252,246,0.7);margin:6px 0 0;">${club_name || "Your club"} is now live</p>
      </div>
      <div style="background:#FFFCF6;padding:28px;border-radius:0 0 12px 12px;border:1px solid #E0F0F0;">
        <p style="color:#003D3D;font-size:15px;">Hi ${full_name},</p>
        <p style="color:#5A9494;line-height:1.7;">Your Apex Track account has been approved. You can now sign in and start managing your squad.</p>
        <a href="${APP_URL}/login" style="display:block;text-align:center;background:linear-gradient(135deg,#006A6A,#008080);color:#FFFCF6;text-decoration:none;padding:14px;border-radius:10px;font-weight:700;margin:20px 0;">Sign In to Dashboard →</a>
        <p style="color:#5A9494;font-size:12px;text-align:center;">Use your registered email and password to sign in.</p>
      </div>
    </div>`

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Apex Track <onboarding@resend.dev>",
        to: [email],
        subject: `✅ Your Apex Track account is ready — ${club_name || ""}`,
        html: welcomeHtml,
      }),
    })

    const resText = await res.text()
    if (!res.ok) {
      return new Response(JSON.stringify({ error: resText }), { 
        status: 500, headers: corsHeaders 
      })
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200, headers: corsHeaders 
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, headers: corsHeaders 
    })
  }
})