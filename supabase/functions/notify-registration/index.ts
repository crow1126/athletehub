// supabase/functions/notify-registration/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SUPERADMIN_EMAIL = "samuelwobil11@gmail.com"
const APP_URL = "https://athletehub-seven.vercel.app"

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record

    if (payload.type !== "INSERT") {
      return new Response("ok", { status: 200 })
    }

    const { full_name, email, club_name, id } = record

    const adminHtml = "<div>New registration from " + (club_name || full_name) + " (" + email + ") - User ID: " + id + " - <a href=" + APP_URL + "/superadmin>Review in Dashboard</a></div>"

    const adminRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Apex Track <onboarding@resend.dev>",
        to: [SUPERADMIN_EMAIL],
        subject: "New Registration: " + (club_name || full_name) + " — Apex Track",
        html: adminHtml,
      }),
    })

    if (!adminRes.ok) {
      const err = await adminRes.text()
      console.error("Resend error:", err)
      return new Response(JSON.stringify({ error: err }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err) {
    console.error("Function error:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
