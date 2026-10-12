import { json, readJSON, writeJSON, requireAdmin, normaliseEduhub, BOOKING_STATUSES } from "./_utils.mjs";
export default async request => {
 if(!requireAdmin(request)) return json({error:"Not signed in"},401);
 if(request.method!=="POST") return json({error:"Method not allowed"},405);
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=="object") return json({error:"Invalid settings."},400);
 if(!String(body.title||"").trim()) return json({error:"An event title is required."},400);
 if(!BOOKING_STATUSES.includes(body.bookingStatus)) return json({error:"Please choose a booking status."},400);
 if(body.privacyNoticeUrl && !/^https:\/\//i.test(body.privacyNoticeUrl)) return json({error:"The privacy notice link must start with https://"},400);
 const current=normaliseEduhub(await readJSON("eduhub",null));
 const next=normaliseEduhub({...body,updatedAt:new Date().toISOString()});
 if(next.bookingStatus==="open" && current.bookingStatus!=="open" && !next.foodChoices.length && body.confirmNoFood!==true){
   return json({error:"There are no food choices yet. Add the menu before opening bookings."},400);
 }
 await writeJSON("eduhub",next); return json({ok:true,eduhub:next});
};
