// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

declare const Deno: any;

const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY")
const SUPERADMIN_EMAIL  = "admin@apextrackgh.com"
const DEFAULT_APP_URL   = Deno.env.get("SITE_URL") || Deno.env.get("APP_URL") || "https://apextrackgh.com"
const LOGO_URL          = "https://apextrackgh.com/logo.png"

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { full_name, email, club_name, reset_link, app_url } = await req.json()

    if (!email || !reset_link) {
      return new Response(JSON.stringify({ error: "email and reset_link are required" }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const APP_URL = app_url || DEFAULT_APP_URL
    const name    = full_name || "there"
    const club    = club_name || "Your Club"

    const htmlBody =
      '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">' +

      // Header
      '<div style="background:linear-gradient(135deg,#022C22,#047857);padding:28px 28px 24px;border-radius:12px 12px 0 0;text-align:center;">' +
        '<img src="' + LOGO_URL + '" alt="Apex Track" width="56" height="56" style="width:56px;height:56px;border-radius:14px;display:inline-block;margin-bottom:10px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.18);" />' +
        '<h1 style="color:#FFFFFF;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Apex Track</h1>' +
        '<p style="color:rgba(236,253,245,0.85);margin:6px 0 0;font-size:14px;">Password Reset Request</p>' +
      '</div>' +

      // Body
      '<div style="background:#FFFCF6;padding:32px 28px;border-radius:0 0 12px 12px;border:1px solid #E0F0F0;">' +
        '<p style="color:#003D3D;font-size:15px;margin:0 0 10px;">Hi ' + name + ',</p>' +
        '<p style="color:#5A9494;line-height:1.7;margin:0 0 20px;">We received a request to reset the password for your <strong style="color:#006A6A;">Apex Track</strong> account associated with <strong>' + email + '</strong>.</p>' +

        // Warning box
        '<div style="background:#FFF8E7;border:1px solid rgba(200,150,0,0.25);border-radius:10px;padding:14px;margin:0 0 20px;">' +
          '<p style="color:#7A5500;font-size:13px;margin:0;font-weight:600;">⏱ This link expires in 1 hour</p>' +
          '<p style="color:#7A5500;font-size:13px;margin:4px 0 0;">If you did not request this, you can safely ignore this email — your password will not change.</p>' +
        '</div>' +

        // CTA Button
        '<a href="' + reset_link + '" style="display:block;text-align:center;background:linear-gradient(135deg,#006A6A,#008080);color:#FFFCF6;text-decoration:none;padding:15px;border-radius:10px;font-weight:700;font-size:15px;margin:0 0 20px;letter-spacing:-0.01em;">Reset My Password →</a>' +

        // Fallback URL
        '<p style="color:#5A9494;font-size:11px;text-align:center;line-height:1.6;margin:0 0 20px;">If the button doesn\'t work, copy and paste this link into your browser:<br/><span style="color:#0D9488;word-break:break-all;">' + reset_link + '</span></p>' +

        // Footer
        '<hr style="border:none;border-top:1px solid #E0F0F0;margin:20px 0;" />' +
        '<p style="color:#94A3B8;font-size:11px;text-align:center;margin:0;">Apex Track · <a href="' + APP_URL + '" style="color:#0D9488;text-decoration:none;">apextrackgh.com</a> · Sent to ' + email + '</p>' +
      '</div>' +

      '</div>'

    // Send to the user
    const userRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    "Apex Track <admin@apextrackgh.com>",
        to:      [email],
        subject: "Reset your Apex Track password",
        html:    htmlBody,
      }),
    })

    if (!userRes.ok) {
      const userErr = await userRes.text()
      console.warn("Password reset email delivery failed for:", email, userErr)

      // Fallback: notify superadmin with the reset link so they can forward
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + RESEND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:    "Apex Track <admin@apextrackgh.com>",
          to:      [SUPERADMIN_EMAIL],
          subject: "Action Required: Forward password reset to " + email,
          html:
            '<p style="background:#FEF9E7;color:#7A5500;padding:12px;border-radius:8px;font-size:13px;">Resend could not deliver to <strong>' + email + '</strong>. Please forward the reset link below:<br/><a href="' + reset_link + '">' + reset_link + '</a></p>' +
            htmlBody,
        }),
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (err: any) {
    console.error("send-password-reset error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
