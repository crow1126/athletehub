// supabase/functions/notify-registration/index.ts
// Called from the app API (activate route) when a club admin verifies their email.
// Also still accepts DB-trigger inserts but filters out internal/non-admin records.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SUPERADMIN_EMAIL = "admin@apextrackgh.com"
const APP_URL = Deno.env.get("SITE_URL") || Deno.env.get("APP_URL") || "https://apextrackgh.com"

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
    const payload = await req.json()

    // Handle both DB-trigger webhook (payload.record) and direct API call
    const record = payload.record || payload
    const isInsert = payload.type === "INSERT" || !payload.type

    if (!isInsert) {
      return new Response("ok", { status: 200 })
    }

    const { full_name, email, club_name, role, event } = record

    // Skip non-admin roles (players, physio, coach, etc. — their accounts are created
    // by their club admin and must NOT generate superadmin notifications).
    if (role && role !== "admin") {
      console.log("Skipping notification for non-admin role:", role)
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "non-admin role" }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Skip internal / synthetic emails used for admin-created accounts
    // e.g. player@players.apextrack.internal  or  staff@apex.local
    if (
      !email ||
      email.endsWith("@players.apextrack.internal") ||
      email.endsWith("@apex.local") ||
      email.includes(".internal") ||
      email.includes(".local") ||
      email.endsWith("@apextrack.internal")
    ) {
      console.log("Skipping notification for internal email:", email)
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "internal email" }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Determine which event triggered the notification
    // event = "verified" means user clicked the email verification link and activated their account
    // event = "registered" (or absent) means they just signed up — we now skip sending anything for
    //          registration and wait for verification instead.
    const isVerified = event === "verified"
    if (!isVerified) {
      // Registration-only trigger — superadmin will see it in the dashboard.
      // No email is sent until the user verifies. This prevents "Pending Email Verification" spam.
      console.log("Skipping superadmin email for unverified registration. User will appear in dashboard once verified.")
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "awaiting verification" }),
        { status: 200, headers: corsHeaders }
      )
    }

    // ── Build superadmin notification email ───────────────────────────────
    const displayName = full_name && full_name.trim() ? full_name.trim() : "A new user"
    const displayClub = club_name && club_name.trim() ? club_name.trim() : "Not specified"
    const verifiedAt = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra"
    })

    const adminHtml =
      '<div style="font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;background:#F9FAFB;padding:24px;">' +

      // Header card
      '<div style="background:linear-gradient(135deg,#004F4F 0%,#007A7A 100%);border-radius:16px 16px 0 0;padding:32px 28px 28px;text-align:center;">' +
      '<div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:4px;">' +
      '<div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;">' +
      '<span style="font-size:22px;">✅</span></div>' +
      '<span style="color:#FFFCF6;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Apex Track</span>' +
      '</div>' +
      '<p style="color:rgba(255,252,246,0.75);margin:8px 0 0;font-size:13px;">Club Registration Verified</p>' +
      '</div>' +

      // Body card
      '<div style="background:#FFFFFF;border-radius:0 0 16px 16px;border:1px solid #E5EDF0;border-top:none;padding:28px;">' +
      '<p style="color:#1A3A3A;font-size:14px;margin:0 0 20px;font-weight:600;">New club account activated 🎉</p>' +
      '<p style="color:#4B6B6B;font-size:13px;line-height:1.65;margin:0 0 20px;">' +
      '<strong style="color:#1A3A3A;">' + displayName + '</strong> has verified their email and their club account is now active.' +
      '</p>' +

      // Info table
      '<div style="background:#F4FAFA;border:1px solid #D6ECEC;border-radius:10px;padding:16px 20px;margin-bottom:22px;">' +
      '<table style="width:100%;border-collapse:collapse;">' +
      '<tr><td style="padding:6px 0;font-size:12px;color:#6B9494;font-weight:600;width:80px;">CLUB</td>' +
      '<td style="padding:6px 0;font-size:13px;color:#1A3A3A;font-weight:700;">' + displayClub + '</td></tr>' +
      '<tr><td style="padding:6px 0;font-size:12px;color:#6B9494;font-weight:600;">EMAIL</td>' +
      '<td style="padding:6px 0;font-size:13px;"><a href="mailto:' + email + '" style="color:#007A7A;text-decoration:none;">' + email + '</a></td></tr>' +
      '<tr><td style="padding:6px 0;font-size:12px;color:#6B9494;font-weight:600;">STATUS</td>' +
      '<td style="padding:6px 0;"><span style="display:inline-block;background:#D1FAE5;color:#065F46;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">✓ Verified & Active</span></td></tr>' +
      '<tr><td style="padding:6px 0;font-size:12px;color:#6B9494;font-weight:600;">VERIFIED</td>' +
      '<td style="padding:6px 0;font-size:12px;color:#4B6B6B;">' + verifiedAt + ' (GMT)</td></tr>' +
      '</table>' +
      '</div>' +

      // CTA button
      '<a href="' + APP_URL + '/superadmin" style="display:block;text-align:center;background:linear-gradient(135deg,#005F5F,#008080);color:#FFFCF6;text-decoration:none;padding:13px 20px;border-radius:12px;font-weight:700;font-size:13px;letter-spacing:0.2px;">View in Superadmin Dashboard →</a>' +

      '<p style="color:#9BB5B5;font-size:11px;text-align:center;margin:16px 0 0;">This club has a 30-day trial running. Review anytime from your dashboard.</p>' +
      '</div>' +

      // Footer
      '<p style="color:#B0C8C8;font-size:10px;text-align:center;margin:16px 0 0;">Apex Track · Ghana · apextrackgh.com</p>' +
      '</div>'

    const adminRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Apex Track <admin@apextrackgh.com>",
        to: [SUPERADMIN_EMAIL],
        subject: "✅ Club Verified: " + displayClub + " is now active",
        html: adminHtml,
      }),
    })

    if (!adminRes.ok) {
      const err = await adminRes.text()
      console.error("Admin notification error:", err)
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error("Function error:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
