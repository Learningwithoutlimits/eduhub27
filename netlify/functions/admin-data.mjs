import { json, readJSON, normaliseEduhub, eduhubEffectiveStatus, requireAdmin } from "./_utils.mjs";
import { emailConfigured, ticketSignature } from "./_tickets.mjs";
export default async request => {
 if(!requireAdmin(request)) return json({error:"Not signed in"},401);
 const [courses,bookings,raw]=await Promise.all([readJSON("courses",[]),readJSON("bookings",[]),readJSON("eduhub",null)]);
 const eduhub=normaliseEduhub(raw);
 return json({courses,bookings:bookings.map(b=>({...b,ticketSig:ticketSignature(b.id)})),eduhub:{...eduhub,effectiveStatus:eduhubEffectiveStatus(eduhub)},emailConfigured:emailConfigured(),mailFrom:emailConfigured()?process.env.MAIL_FROM:""});
};
