// Administrator actions on a single booking.
import { allergenSummary } from "../../public/assets/allergens.js";
import { sendConfirmation, siteOrigin } from "./_tickets.mjs";
import { json, readJSON, updateJSON, requireAdmin, clean, normaliseEduhub, EDUHUB_ID, slotKey, slotLabel, PHASE_NAMES } from "./_utils.mjs";

export default async request => {
 if(!requireAdmin(request)) return json({error:"Not signed in"},401);
 const body=await request.json().catch(()=>({}));
 const id=clean(body.id,80);
 if(!id) return json({error:"Missing booking."},400);

 if(request.method==="DELETE"){
   const found=await updateJSON("bookings",[],bookings=>{
     const next=bookings.filter(b=>b.id!==id);
     return next.length===bookings.length?{result:false}:{value:next,result:true};
   });
   return found?json({ok:true}):json({error:"Booking not found."},404);
 }
 if(request.method!=="POST") return json({error:"Method not allowed"},405);

 const eduhub=normaliseEduhub(await readJSON("eduhub",null));
 const result=await updateJSON("bookings",[],bookings=>{
   const b=bookings.find(x=>x.id===id);
   if(!b) return {result:{error:"Booking not found.",status:404}};
   const now=new Date().toISOString();
   switch(body.action){
     case "cancel": b.cancelled=true; b.cancelledAt=now; break;
     case "reinstate": b.cancelled=false; delete b.cancelledAt; break;
     case "confirm": b.waitingList=false; b.cancelled=false; b.sendEmail=true; break;
     case "resend": b.sendEmail=true; break;
     case "checkin": if(!b.checkedInAt) b.checkedInAt=now; break;
     case "undo-checkin": delete b.checkedInAt; break;
     case "waiting": b.waitingList=true; break;
     case "update": {
       const f=body.fields||{};
       for(const [k,max] of [["firstName",80],["lastName",80],["organisation",150],["jobTitle",120],["telephone",40],["dietary",600],["accessibility",600],["notes",1000],["adminNotes",1000]]){
         if(k in f) b[k]=clean(f[k],max);
       }
       if(b.itemId===EDUHUB_ID && "foodChoiceId" in f){
         if(f.foodChoiceId==="no-food"){ Object.assign(b,{foodChoiceId:"no-food",foodChoice:"Bringing own food",foodAllergens:""}); }
         else if(!f.foodChoiceId){ Object.assign(b,{foodChoiceId:"",foodChoice:"",foodAllergens:""}); }
         else{
           const c=eduhub.foodChoices.find(x=>x.id===f.foodChoiceId);
           if(!c) return {result:{error:"That food choice no longer exists.",status:400}};
           Object.assign(b,{foodChoiceId:c.id,foodChoice:c.name,foodAllergens:allergenSummary(c)});
         }
       }
       if(b.itemId===EDUHUB_ID && "schoolId" in f && eduhub.schools.length){
         const school=eduhub.schools.find(x=>x.id===f.schoolId);
         if(!school) return {result:{error:"Please choose a school from the list.",status:400}};
         Object.assign(b,{schoolId:school.id,organisation:school.name,phase:school.phase,phaseName:PHASE_NAMES[school.phase]});
       }
       // Administrators may place someone in any session, including one outside
       // their phase or over capacity, but still only one per time slot.
       if(b.itemId===EDUHUB_ID && Array.isArray(f.sessionIds)){
         const chosen=[];
         for(const sid of new Set(f.sessionIds.map(x=>clean(x,140)).filter(Boolean))){
           const s=eduhub.sessions.find(x=>x.id===sid);
           if(!s) return {result:{error:"One of those workshops no longer exists.",status:400}};
           if(chosen.some(x=>slotKey(x)===slotKey(s))) return {result:{error:`Only one workshop can be chosen for ${slotLabel(s)}.`,status:400}};
           if(s.workshopId && chosen.some(x=>x.workshopId===s.workshopId)) return {result:{error:`"${s.title}" has been chosen in more than one round.`,status:400}};
           chosen.push(s);
         }
         b.sessionIds=chosen.map(x=>x.id);
         b.sessions=chosen.map(x=>({id:x.id,title:x.title,time:slotLabel(x),room:x.room,speaker:x.speakerName||""}));
       }
       break;
     }
     default: return {result:{error:"Unknown action.",status:400}};
   }
   b.updatedAt=now;
   return {value:bookings,result:{booking:b}};
 });
 if(result.error) return json({error:result.error},result.status);
 // Giving someone a place, or resending, emails them their ticket.
 let email=null;
 if(result.booking.sendEmail){
   await updateJSON("bookings",[],list=>{const x=list.find(y=>y.id===id); if(!x) return {result:null}; delete x.sendEmail; return {value:list,result:null};});
   email=await sendConfirmation(id,siteOrigin(request));
 }
 const {sendEmail,...booking}=result.booking;
 return json({ok:true,booking,email});
};
