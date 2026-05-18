// supabase/functions/notify-registration/index.ts
// Triggered on profiles INSERT - sends admin notification AND user welcome
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SUPERADMIN_EMAIL = "samuelwobil11@gmail.com"
const APP_URL = "https://athletehub-seven.vercel.app"

serve(async (req) => {
  try {
    const payload = await req.json()

    // Handle both webhook (DB trigger) and direct invocation
    const record = payload.record || payload
    const isInsert = payload.type === "INSERT" || !payload.type

    if (!isInsert) {
      return new Response("ok", { status: 200 })
    }

    const { full_name, email, club_name, id } = record

    // 1. Notify superadmin about the new registration
    const adminHtml = '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">' +
      '<div style="background:linear-gradient(135deg,#004F4F,#008080);padding:24px;border-radius:12px 12px 0 0;text-align:center;">' +
      '<h1 style="color:#FFFCF6;margin:0;font-size:20px;">New Registration</h1>' +
      '</div>' +
      '<div style="background:#FFFCF6;padding:24px;border-radius:0 0 12px 12px;border:1px solid #E0F0F0;">' +
      '<p style="color:#003D3D;font-size:14px;margin:0 0 12px;"><strong>' + (full_name || 'New User') + '</strong> just signed up.</p>' +
      '<table style="width:100%;font-size:13px;color:#5A9494;">' +
      '<tr><td style="padding:4px 0;">Email</td><td style="padding:4px 0;color:#003D3D;">' + email + '</td></tr>' +
      '<tr><td style="padding:4px 0;">Club</td><td style="padding:4px 0;color:#003D3D;">' + (club_name || 'Not specified') + '</td></tr>' +
      '<tr><td style="padding:4px 0;">Status</td><td style="padding:4px 0;color:#27AE60;font-weight:700;">Auto-approved (30-day trial)</td></tr>' +
      '</table>' +
      '<a href="' + APP_URL + '/superadmin" style="display:block;text-align:center;background:linear-gradient(135deg,#006A6A,#008080);color:#FFFCF6;text-decoration:none;padding:12px;border-radius:10px;font-weight:700;margin:18px 0 0;font-size:13px;">View in Dashboard</a>' +
      '</div></div>'

    const adminRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Apex Track <onboarding@resend.dev>",
        to: [SUPERADMIN_EMAIL],
        subject: "New Signup: " + (club_name || full_name) + " - Auto-provisioned",
        html: adminHtml,
      }),
    })

    if (!adminRes.ok) {
      const err = await adminRes.text()
      console.error("Admin notification error:", err)
    }

    // 2. Send welcome to the registering user
    const userHtml = '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">' +
      '<div style="background:linear-gradient(135deg,#004F4F,#008080);padding:28px;border-radius:12px 12px 0 0;text-align:center;">' +
      '<h1 style="color:#FFFCF6;margin:0;font-size:22px;">Welcome to Apex Track</h1>' +
      '<p style="color:rgba(255,252,246,0.7);margin:6px 0 0;">' + (club_name || "Your club") + ' is now live</p>' +
      '</div>' +
      '<div style="background:#FFFCF6;padding:28px;border-radius:0 0 12px 12px;border:1px solid #E0F0F0;">' +
      '<p style="color:#003D3D;font-size:15px;">Hi ' + (full_name || 'there') + ',</p>' +
      '<p style="color:#5A9494;line-height:1.7;">Your account has been automatically set up with a <strong style="color:#006A6A;">30-day free trial</strong>. Your team and subscription are ready.</p>' +
      '<div style="background:#E8F8EE;border:1px solid rgba(39,174,96,0.2);border-radius:10px;padding:14px;margin:16px 0;">' +
      '<p style="color:#1B6B3A;font-size:13px;margin:0;font-weight:600;">Team "' + (club_name || 'Your Club') + '" created</p>' +
      '<p style="color:#1B6B3A;font-size:13px;margin:4px 0 0;">30-day trial activated</p>' +
      '</div>' +
      '<p style="color:#5A9494;font-size:13px;">Please confirm your email first (check your inbox), then sign in:</p>' +
      '<a href="' + APP_URL + '/login" style="display:block;text-align:center;background:linear-gradient(135deg,#006A6A,#008080);color:#FFFCF6;text-decoration:none;padding:14px;border-radius:10px;font-weight:700;margin:16px 0;font-size:14px;">Sign In to Dashboard</a>' +
      '<p style="color:#5A9494;font-size:11px;text-align:center;">Use your registered email and password to sign in.</p>' +
      '</div></div>'

    try {
      const userRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + RESEND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Apex Track <onboarding@resend.dev>",
          to: [email],
          subject: "Welcome to Apex Track - Your 30-day trial is active!",
          html: userHtml,
        }),
      })

      if (!userRes.ok) {
        const userErr = await userRes.text()
        console.warn("User welcome email failed (Resend free tier limitation):", userErr)
      }
    } catch (e) {
      console.warn("User email send failed:", e.message)
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err) {
    console.error("Function error:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
