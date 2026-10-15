// Tickets (QR codes) and confirmation emails.
import crypto from "node:crypto";
import QRCode from "qrcode";
import { EDUHUB_ID, normaliseEduhub, readJSON, updateJSON } from "./_utils.mjs";

// ---------- Tickets ----------
// A ticket link carries the booking id and a signature made with
// SESSION_SECRET, so links cannot be guessed or altered. Changing
// SESSION_SECRET after bookings open would invalidate every ticket.
export function ticketSignature(bookingId){
  const secret = process.env.SESSION_SECRET || "";
  if(secret.length < 32) return "";
  return crypto.createHmac("sha256", secret).update(`ticket:${bookingId}`).digest("base64url").slice(0, 22);
}
export function validTicket(bookingId, signature){
  const expected = ticketSignature(bookingId);
  if(!expected || typeof signature !== "string" || signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
export const siteOrigin = request => process.env.URL || new URL(request.url).origin;
export function ticketUrl(origin, bookingId){
  const sig = ticketSignature(bookingId);
  return sig ? `${origin}/ticket/?b=${encodeURIComponent(bookingId)}&s=${sig}` : "";
}
export const qrPng = text => QRCode.toBuffer(text, { width: 360, margin: 2, errorCorrectionLevel: "M", color: { dark: "#183033", light: "#ffffff" } });

// ---------- Email through Microsoft 365 ----------
// Needs four Netlify environment variables, set up by IT:
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET  (an Entra app with Mail.Send)
//   MAIL_FROM  (the mailbox that sends, e.g. eduhub@lwlat.org.uk)
const env = k => String(process.env[k] || "").trim();
export const emailConfigured = () => Boolean(env("MS_TENANT_ID") && env("MS_CLIENT_ID") && env("MS_CLIENT_SECRET") && env("MAIL_FROM"));
const loginBase = () => env("MS_LOGIN_BASE") || "https://login.microsoftonline.com"; // overridable for tests only
const graphBase = () => env("MS_GRAPH_BASE") || "https://graph.microsoft.com";

let cachedToken = null;
async function graphToken(){
  if(cachedToken && cachedToken.expires > Date.now() + 60000) return cachedToken.value;
  const res = await fetch(`${loginBase()}/${encodeURIComponent(env("MS_TENANT_ID"))}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("MS_CLIENT_ID"), client_secret: env("MS_CLIENT_SECRET"), scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    signal: AbortSignal.timeout(6000)
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok || !data.access_token) throw new Error(`Microsoft sign-in failed (${data.error || res.status}). Check MS_TENANT_ID, MS_CLIENT_ID and MS_CLIENT_SECRET.`);
  cachedToken = { value: data.access_token, expires: Date.now() + (Number(data.expires_in) || 3000) * 1000 };
  return cachedToken.value;
}

export async function sendMail({ to, subject, html, text, inlinePng }){
  if(!emailConfigured()) throw new Error("Email is not set up yet.");
  const message = {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: [{ emailAddress: { address: to } }]
  };
  if(inlinePng) message.attachments = [{ "@odata.type": "#microsoft.graph.fileAttachment", name: "ticket-qr-code.png", contentType: "image/png", contentId: "ticketqr", isInline: true, contentBytes: inlinePng.toString("base64") }];
  const res = await fetch(`${graphBase()}/v1.0/users/${encodeURIComponent(env("MAIL_FROM"))}/sendMail`, {
    method: "POST",
    headers: { authorization: `Bearer ${await graphToken()}`, "content-type": "application/json" },
    body: JSON.stringify({ message, saveToSentItems: false }),
    signal: AbortSignal.timeout(8000)
  });
  if(!res.ok){
    const data = await res.json().catch(() => ({}));
    throw new Error(`Microsoft 365 refused the email (${data?.error?.code || res.status}). Check that MAIL_FROM is a real mailbox and the app has Mail.Send permission.`);
  }
}

// ---------- Confirmation email ----------
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmtDate = v => v ? new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/London" }).format(new Date(v + "T12:00:00Z")).replace(",", "") : "";
const row = (label, value) => value ? `<tr><td style="padding:6px 12px 6px 0;color:#586d70;vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:6px 0;vertical-align:top">${value}</td></tr>` : "";

function eventFacts(b, eduhub, course){
  if(b.itemId === EDUHUB_ID){
    return [
      ["Date", esc(fmtDate(eduhub.date))], ["Time", esc(eduhub.time)], ["Venue", esc(eduhub.venue)],
      ["School or team", esc(b.organisation)],
      ["Sessions", (b.sessions || []).map(s => `${esc(s.time)}: ${esc(s.title)}${s.room ? `, ${esc(s.room)}` : ""}`).join("<br>")],
      ["Food choice", esc(b.foodChoice)]
    ];
  }
  const sessions = Array.isArray(course?.sessions) && course.sessions.length ? course.sessions : [{ date: course?.date, time: course?.time }];
  return [
    ["Dates", sessions.filter(s => s.date).map(s => `${esc(fmtDate(s.date))}${s.time ? `, ${esc(s.time)}` : ""}`).join("<br>")],
    ["Venue", esc(course?.venue)]
  ];
}

export function confirmationEmail(b, { eduhub, course, url }){
  const waiting = Boolean(b.waitingList);
  const title = b.itemTitle || "your booking";
  const contact = b.itemId === EDUHUB_ID ? eduhub.contactEmail : "";
  const subject = waiting ? `Waiting list: ${title} (${b.reference})` : `Your booking for ${title} (${b.reference})`;
  const facts = [["Booking reference", `<strong>${esc(b.reference)}</strong>`], ...eventFacts(b, eduhub, course)].map(([l, v]) => row(l, v)).join("");
  const ticket = waiting || !url ? "" : `
    <h2 style="font-size:18px;margin:28px 0 8px;color:#009189">Your ticket</h2>
    <p style="margin:0 0 12px">Please bring this QR code with you on the day, either on your phone or printed. We will scan it when you arrive.</p>
    <p style="margin:0 0 12px"><img src="cid:ticketqr" width="220" height="220" alt="QR code for booking ${esc(b.reference)}" style="display:block;border:1px solid #d5e7e4;border-radius:8px"></p>
    <p style="margin:0 0 12px;font-size:14px">If the code does not show, <a href="${esc(url)}" style="color:#009189">open your ticket here</a>.</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f8f8;font-family:'Open Sans',Arial,sans-serif;color:#183033;line-height:1.5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8f8;padding:24px 0"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#009189;color:#ffffff;padding:20px 28px;font-size:13px;letter-spacing:1px;text-transform:uppercase;font-weight:bold">Learning Without Limits Academy Trust</td></tr>
  <tr><td style="padding:28px">
    <p style="margin:0 0 12px">Dear ${esc(b.firstName)},</p>
    ${waiting
      ? `<p style="margin:0 0 12px">Thank you for your interest in <strong>${esc(title)}</strong>. All places are currently taken, so you have been added to the waiting list. We will email you again if a place becomes available.</p>`
      : `<p style="margin:0 0 12px">Thank you for booking your place at <strong>${esc(title)}</strong>. Your booking is confirmed.</p>`}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:15px">${facts}</table>
    ${ticket}
    ${b.itemId === EDUHUB_ID && eduhub.recognitionUrl ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;background:#eef7f6;border-radius:8px"><tr><td style="padding:18px 20px">
      <p style="margin:0 0 6px;font-weight:bold;color:#009189">Recognising colleagues</p>
      <p style="margin:0 0 12px">Do you know a colleague whose work deserves recognition? You can nominate them for a recognition award using a short form.</p>
      <a href="${esc(eduhub.recognitionUrl)}" style="display:inline-block;background:#009189;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:999px">Nominate a colleague</a>
    </td></tr></table>` : ""}
    <p style="margin:24px 0 0">If you need to change or cancel your booking, please ${contact ? `email <a href="mailto:${esc(contact)}" style="color:#009189">${esc(contact)}</a>` : "reply to this email"} and quote your booking reference.</p>
    <p style="margin:24px 0 0">Kind regards,<br>Learning Without Limits Academy Trust</p>
  </td></tr>
  <tr><td style="background:#17383a;color:#ffffff;padding:16px 28px;font-size:13px">Winning hearts and inspiring minds to learn without limits.</td></tr>
  </table></td></tr></table></body></html>`;
  return { subject, html };
}

// Sends the confirmation for one booking and records the outcome on it.
// Never throws: a booking is valid whether or not the email goes.
export async function sendConfirmation(bookingId, origin){
  if(!emailConfigured()) return { sent: false, reason: "not-configured" };
  const bookings = await readJSON("bookings", []);
  const b = bookings.find(x => x.id === bookingId);
  if(!b) return { sent: false, reason: "missing" };
  let outcome;
  try{
    const eduhub = normaliseEduhub(await readJSON("eduhub", null));
    const course = b.itemId === EDUHUB_ID ? null : (await readJSON("courses", [])).find(c => c.id === b.itemId);
    const url = ticketUrl(origin, b.id);
    const { subject, html } = confirmationEmail(b, { eduhub, course, url });
    await sendMail({ to: b.email, subject, html, inlinePng: !b.waitingList && url ? await qrPng(url) : null });
    outcome = { emailSentAt: new Date().toISOString(), emailError: "", emailType: b.waitingList ? "waiting" : "confirmed" };
  }catch(err){
    outcome = { emailError: String(err.message || err).slice(0, 300), emailFailedAt: new Date().toISOString() };
  }
  await updateJSON("bookings", [], list => {
    const x = list.find(y => y.id === bookingId);
    if(!x) return { result: null };
    Object.assign(x, outcome);
    return { value: list, result: null };
  }).catch(() => {});
  return outcome.emailSentAt ? { sent: true } : { sent: false, reason: outcome.emailError };
}
