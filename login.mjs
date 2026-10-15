import crypto from "node:crypto";
import { json, makeToken, sessionConfigured, updateJSON, clientIp } from "./_utils.mjs";

const WINDOW=15*60*1000, MAX_FAILURES=8;
const key=ip=>crypto.createHash("sha256").update(ip).digest("hex").slice(0,24);

async function recordAttempt(ip, failed){
  return updateJSON("login-attempts",{},attempts=>{
    const now=Date.now();
    for(const [k,v] of Object.entries(attempts)) if(now-v.first>WINDOW) delete attempts[k];
    const k=key(ip);
    if(!failed){ if(!attempts[k]) return {result:0}; delete attempts[k]; return {value:attempts,result:0}; }
    attempts[k]=attempts[k]?{...attempts[k],count:attempts[k].count+1}:{first:now,count:1};
    return {value:attempts,result:attempts[k].count};
  }).catch(()=>0);
}

export default async (request) => {
  if(request.method!=="POST") return json({error:"Method not allowed"},405);
  const expected=process.env.ADMIN_PASSWORD;
  if(!expected) return json({error:"ADMIN_PASSWORD is not configured in Netlify."},500);
  if(!sessionConfigured()) return json({error:"SESSION_SECRET must be set in Netlify and be at least 32 characters long."},500);
  const ip=clientIp(request);
  const attempts=await updateJSON("login-attempts",{},a=>({result:a[key(ip)]})).catch(()=>null);
  if(attempts && Date.now()-attempts.first<WINDOW && attempts.count>=MAX_FAILURES){
    return json({error:"Too many unsuccessful attempts. Please wait 15 minutes and try again."},429);
  }
  const {password=""}=await request.json().catch(()=>({}));
  const a=crypto.createHash("sha256").update(String(password)).digest();
  const b=crypto.createHash("sha256").update(String(expected)).digest();
  if(!crypto.timingSafeEqual(a,b)){
    await recordAttempt(ip,true);
    await new Promise(r=>setTimeout(r,600));
    return json({error:"Incorrect password."},401);
  }
  await recordAttempt(ip,false);
  return json({ok:true},200,{"set-cookie":`lwlat_admin=${makeToken()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`});
};
