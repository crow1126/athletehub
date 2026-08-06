import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SUPERADMIN_EMAIL = "admin@apextrackgh.com"
const DEFAULT_APP_URL = Deno.env.get("SITE_URL") || Deno.env.get("APP_URL") || "https://athletehub-seven.vercel.app"

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
    const { full_name, email, club_name, club_logo_url, action_link, app_url } = await req.json()

    const APP_URL = app_url || DEFAULT_APP_URL
    const needsVerification = !!action_link
    const buttonUrl = action_link || `${APP_URL}/login`
    const buttonText = needsVerification ? 'Confirm Email & Activate Account' : 'Sign In to Dashboard'
    const instructionText = needsVerification
      ? 'Before you can sign in, confirm your email by clicking the button below. This activates your club account and 30-day trial:'
      : 'Your team and subscription have been set up. Sign in using the button below with your registered email and password:'
    const footerText = needsVerification
      ? 'After confirming, return to Apex Track and sign in with the email and password you registered.'
      : 'Use your registered email and password to sign in.'

    const logoUrl = 'https://apextrackgh.com/logo.png'

    const welcomeHtml = '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">' +
      '<div style="background:linear-gradient(135deg,#022C22,#047857);padding:28px 28px 24px;border-radius:12px 12px 0 0;text-align:center;">' +
      '<img src="' + logoUrl + '" alt="Apex Track" width="56" height="56" style="width:56px;height:56px;border-radius:14px;display:inline-block;margin-bottom:10px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />' +
      '<h1 style="color:#FFFFFF;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Apex Track</h1>' +
      '<p style="color:rgba(236,253,245,0.85);margin:6px 0 0;font-size:14px;">' + (club_name || "Your club") + ' is now live</p>' +
      '</div>' +
      '<div style="background:#FFFCF6;padding:28px;border-radius:0 0 12px 12px;border:1px solid #E0F0F0;">' +
      '<p style="color:#003D3D;font-size:15px;">Hi ' + (full_name || 'there') + ',</p>' +
      '<p style="color:#5A9494;line-height:1.7;">Your Apex Track account is ready with a <strong style="color:#006A6A;">30-day free trial</strong>.</p>' +
      '<div style="background:#E8F8EE;border:1px solid rgba(39,174,96,0.2);border-radius:10px;padding:14px;margin:16px 0;">' +
      '<p style="color:#1B6B3A;font-size:13px;margin:0;font-weight:600;">Team "' + (club_name || 'Your Club') + '" created</p>' +
      '<p style="color:#1B6B3A;font-size:13px;margin:4px 0 0;">30-day trial activated</p>' +
      '</div>' +
      '<p style="color:#5A9494;line-height:1.6;margin-bottom:16px;">' + instructionText + '</p>' +
      '<a href="' + buttonUrl + '" style="display:block;text-align:center;background:linear-gradient(135deg,#006A6A,#008080);color:#FFFCF6;text-decoration:none;padding:14px;border-radius:10px;font-weight:700;margin:16px 0;font-size:14px;">' + buttonText + '</a>' +
      '<p style="color:#5A9494;font-size:11px;text-align:center;">' + footerText + '</p>' +
      '</div></div>'

    // Send to the user
    const userRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Apex Track <admin@apextrackgh.com>",
        to: [email],
        subject: needsVerification
          ? "Confirm your email - Apex Track"
          : "Welcome to Apex Track - Your 30-day trial is active!",
        html: welcomeHtml,
      }),
    })

    if (!userRes.ok) {
      const userErr = await userRes.text()
      console.warn("User email failed:", userErr)
      // Fallback: send to superadmin with user info so they can forward
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + RESEND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Apex Track <admin@apextrackgh.com>",
          to: [SUPERADMIN_EMAIL],
          subject: needsVerification
            ? "Action Required: Forward to " + email + " - Confirm your email"
            : "Forward to " + email + " - Welcome to Apex Track",
          html: '<p style="color:#8B2020;font-size:13px;background:#FEF9E7;padding:12px;border-radius:8px;">Resend free tier cannot deliver to ' + email + '. Forward this verification/welcome email to them, or add a verified domain in Resend.</p>' + welcomeHtml,
        }),
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
