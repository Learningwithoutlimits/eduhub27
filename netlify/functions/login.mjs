import crypto from "node:crypto"; import { json, makeToken } from "./_utils.mjs";
export default async (request) => {
  if(request.method!=="POST") return json({error:"Method not allowed"},405);
  const {password=""}=await request.json().catch(()=>({}));
  const expected=process.env.ADMIN_PASSWORD;
  if(!expected) return json({error:"ADMIN_PASSWORD is not configured in Netlify."},500);
  const a=Buffer.from(String(password)), b=Buffer.from(String(expected));
  const ok=a.length===b.length && crypto.timingSafeEqual(a,b);
  if(!ok) return json({error:"Incorrect password."},401);
  return json({ok:true},200,{"set-cookie":`lwlat_admin=${makeToken()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`});
};
