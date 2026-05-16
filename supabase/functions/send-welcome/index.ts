// supabase/functions/send-welcome/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const APP_URL = "https://athletehub-seven.vercel.app"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } })
  }

  try {
    const { full_name, email, club_name, club_logo_url } = await req.json()

    const welcomeHtml = "<div>Hi " + full_name + ", your Apex Track account for " + (club_name || "your club") + " has been approved. <a href=" + APP_URL + "/login>Sign in here</a></div>"

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Apex Track <onboarding@resend.dev>",
        to: [email],
        subject: "Your Apex Track account is ready — " + (club_name || ""),
        html: welcomeHtml,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(JSON.stringify({ error: err }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
