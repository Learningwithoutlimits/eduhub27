// Lets an administrator check that Microsoft 365 email is working.
import { json, requireAdmin, isEmail, clean } from "./_utils.mjs";
import { emailConfigured, sendMail } from "./_tickets.mjs";
export default async request => {
 if(!requireAdmin(request)) return json({ error: "Not signed in" }, 401);
 if(request.method !== "POST") return json({ error: "Method not allowed" }, 405);
 if(!emailConfigured()) return json({ error: "Email is not set up yet. IT need to add MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET and MAIL_FROM in Netlify." }, 400);
 const { to = "" } = await request.json().catch(() => ({}));
 const address = clean(to, 160).toLowerCase();
 if(!isEmail(address)) return json({ error: "Please enter a valid email address." }, 400);
 try{
   await sendMail({ to: address, subject: "Learning Hub test email", html: "<p>This is a test email from the Learning Without Limits Learning Hub. If you can read this, booking confirmations are working.</p>" });
   return json({ ok: true });
 }catch(err){ return json({ error: err.message }, 502); }
};
