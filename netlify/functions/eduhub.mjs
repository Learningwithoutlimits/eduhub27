import { json, updateJSON, requireAdmin, normaliseEduhub, BOOKING_STATUSES, PROGRAMME_FIELDS } from "./_utils.mjs";

// Two admin screens save to the EduHub record: "EduHub 2027" (event details
// and food) and "EduHub sessions" (schools and sessions). Each sends
// section "details" or "programme" and only its own fields are changed.
export default async request => {
 if(!requireAdmin(request)) return json({error:"Not signed in"},401);
 if(request.method!=="POST") return json({error:"Method not allowed"},405);
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=="object") return json({error:"Invalid settings."},400);
 const section=body.section==="programme"?"programme":"details";

 if(section==="details"){
   if(!String(body.title||"").trim()) return json({error:"An event title is required."},400);
   if(!BOOKING_STATUSES.includes(body.bookingStatus)) return json({error:"Please choose a booking status."},400);
   if(body.privacyNoticeUrl && !/^https:\/\//i.test(body.privacyNoticeUrl)) return json({error:"The privacy notice link must start with https://"},400);
   if(body.recognitionUrl && !/^https:\/\//i.test(body.recognitionUrl)) return json({error:"The recognition award link must start with https://"},400);
 }else{
   const sessions=Array.isArray(body.sessions)?body.sessions:[];
   const badTime=sessions.find(s=>String(s?.title||"").trim() && s.startTime && s.endTime && s.endTime<=s.startTime);
   if(badTime) return json({error:`"${badTime.title}" finishes before it starts. Please check its times.`},400);
 }

 try{
   const result=await updateJSON("eduhub",null,raw=>{
     const current=normaliseEduhub(raw);
     const incoming=Object.fromEntries(Object.entries(body).filter(([k])=>section==="programme"?PROGRAMME_FIELDS.includes(k):!PROGRAMME_FIELDS.includes(k)));
     const next=normaliseEduhub({...current,...incoming,updatedAt:new Date().toISOString()});
     if(section==="details" && next.bookingStatus==="open" && current.bookingStatus!=="open" && !next.foodChoices.length && body.confirmNoFood!==true){
       return {result:{error:"There are no food choices yet. Add the menu before opening bookings."}};
     }
     return {value:next,result:{eduhub:next}};
   });
   if(result.error) return json({error:result.error},400);
   return json({ok:true,eduhub:result.eduhub});
 }catch(err){
   return json({error:err.message},503);
 }
};
