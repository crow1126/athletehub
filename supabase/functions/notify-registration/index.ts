// supabase/functions/notify-registration/index.ts
// Triggered on profiles INSERT - sends admin notification AND user welcome
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SUPERADMIN_EMAIL = "admin@apextrackgh.com"
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

    const { full_name, email, club_name, role } = record

    // Only send notifications for new club admin registrations.
    // Staff profiles (coach, physio, etc.) are issued logins by their admin
    // and should NOT trigger superadmin notifications or welcome emails.
    if (role !== "admin") {
      console.log("Skipping notification for non-admin role:", role)
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "non-admin role" }), { status: 200 })
    }

    // 1. Notify superadmin about the new club registration
    const adminHtml = '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">' +
      '<div style="background:linear-gradient(135deg,#004F4F,#008080);padding:24px;border-radius:12px 12px 0 0;text-align:center;">' +
      '<h1 style="color:#FFFCF6;margin:0;font-size:20px;">New Club Registration</h1>' +
      '</div>' +
      '<div style="background:#FFFCF6;padding:24px;border-radius:0 0 12px 12px;border:1px solid #E0F0F0;">' +
      '<p style="color:#003D3D;font-size:14px;margin:0 0 12px;"><strong>' + (full_name || 'New User') + '</strong> just registered a new club.</p>' +
      '<table style="width:100%;font-size:13px;color:#5A9494;">' +
      '<tr><td style="padding:4px 0;">Email</td><td style="padding:4px 0;color:#003D3D;">' + email + '</td></tr>' +
      '<tr><td style="padding:4px 0;">Club</td><td style="padding:4px 0;color:#003D3D;">' + (club_name || 'Not specified') + '</td></tr>' +
      '<tr><td style="padding:4px 0;">Status</td><td style="padding:4px 0;color:#E67E22;font-weight:700;">Pending Email Verification</td></tr>' +
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
        from: "Apex Track <admin@apextrackgh.com>",
        to: [SUPERADMIN_EMAIL],
        subject: "New Club Registration: " + (club_name || full_name),
        html: adminHtml,
      }),
    })

    if (!adminRes.ok) {
      const err = await adminRes.text()
      console.error("Admin notification error:", err)
    }

    // User welcome email is handled by the signup-provision API route calling /functions/v1/send-welcome with the generated token link.
    // This DB trigger function only notifies the superadmin.

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err) {
    console.error("Function error:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
