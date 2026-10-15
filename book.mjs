import { allergenSummary } from "../../public/assets/allergens.js";
import { json, readJSON, updateJSON, clean, isEmail, STAFF_DOMAIN, normaliseEduhub, eduhubEffectiveStatus,
  courseBookingClosedReason, placesTaken, activeBooking, makeReference, EDUHUB_ID,
  slotKey, slotLabel, sessionPlacesTaken, PHASE_NAMES } from "./_utils.mjs";
import { sendConfirmation, ticketUrl, siteOrigin } from "./_tickets.mjs";

const NO_FOOD = "no-food";

export default async request => {
 if(request.method!=="POST") return json({error:"Method not allowed"},405);
 const raw=await request.json().catch(()=>null);
 if(!raw || typeof raw!=="object") return json({error:"Please complete the booking form."},400);

 // Hidden "website" field: people never see it, so only automated spam fills it in.
 if(clean(raw.website)) return json({ok:true,waitingList:false,reference:""});

 const b={
   itemType: raw.itemType==="eduhub" ? "eduhub" : "course",
   itemId: clean(raw.itemId,120),
   firstName: clean(raw.firstName,80),
   lastName: clean(raw.lastName,80),
   email: clean(raw.email,160).toLowerCase(),
   organisation: clean(raw.organisation,150),
   jobTitle: clean(raw.jobTitle,120),
   telephone: clean(raw.telephone,40),
   dietary: clean(raw.dietary,600),
   accessibility: clean(raw.accessibility,600),
   notes: clean(raw.notes,1000)
 };
 let eduhub=null;
 if(b.itemType==="eduhub"){
   eduhub=normaliseEduhub(await readJSON("eduhub",null));
   // With a school list, the school decides which sessions someone can book.
   if(eduhub.schools.length){
     const school=eduhub.schools.find(x=>x.id===clean(raw.schoolId,60));
     if(!school) return json({error:"Please choose your school or team from the list."},400);
     Object.assign(b,{schoolId:school.id,organisation:school.name,phase:school.phase});
   }
 }
 if(!b.firstName||!b.lastName||!b.email||!b.organisation) return json({error:"Please complete all required fields."},400);
 if(!isEmail(b.email)) return json({error:"Please enter a valid email address."},400);

 let item, extra={};
 if(b.itemType==="eduhub"){
   const status=eduhubEffectiveStatus(eduhub);
   if(status==="coming-soon") return json({error:"EduHub bookings have not opened yet."},403);
   if(status!=="open") return json({error:"EduHub bookings are now closed."},403);
   if(!b.email.endsWith(STAFF_DOMAIN)) return json({error:`EduHub 2027 is for LwLAT staff. Please use your ${STAFF_DOMAIN} email address.`},400);
   if(raw.consent!==true && raw.consent!=="true" && raw.consent!=="on") return json({error:"Please confirm that you have read how we will use your information."},400);
   if(!eduhub.askDietary) b.dietary="";
   if(!eduhub.askAccessibility) b.accessibility="";
   b.itemId=EDUHUB_ID;
   item={...eduhub,id:EDUHUB_ID};
   if(eduhub.foodChoices.length){
     const chosen=clean(raw.foodChoiceId,80);
     if(chosen===NO_FOOD && eduhub.allowNoFood){
       extra={foodChoiceId:NO_FOOD,foodChoice:"No food required",foodAllergens:""};
     }else{
       const choice=eduhub.foodChoices.find(c=>c.id===chosen);
       if(!choice) return json({error:"Please choose your food option."},400);
       extra={foodChoiceId:choice.id,foodChoice:choice.name,foodAllergens:allergenSummary(choice)};
     }
   }
   // Sessions: one per time slot, only those aimed at the person's phase.
   const wanted=[...new Set((Array.isArray(raw.sessionIds)?raw.sessionIds:[]).map(x=>clean(x,60)))];
   const eligible=eduhub.sessions.filter(x=>!b.phase||x.audiences.includes(b.phase));
   const chosen=[];
   for(const id of wanted){
     const session=eligible.find(x=>x.id===id);
     if(!session) return json({error:"One of the sessions you chose is not available to you. Please check your choices."},400);
     if(chosen.some(x=>slotKey(x)===slotKey(session))) return json({error:`Please choose only one session for ${slotLabel(session)}.`},400);
     chosen.push(session);
   }
   if(eduhub.requireSessionChoice){
     const slots=[...new Set(eligible.map(slotKey))];
     const missing=slots.filter(k=>!chosen.some(x=>slotKey(x)===k));
     if(missing.length){
       const first=eligible.find(x=>slotKey(x)===missing[0]);
       return json({error:`Please choose a session for ${slotLabel(first)}.`},400);
     }
   }
   extra.sessionIds=chosen.map(x=>x.id);
   extra.sessions=chosen.map(x=>({id:x.id,title:x.title,time:slotLabel(x),room:x.room}));
   if(b.phase) extra.phaseName=PHASE_NAMES[b.phase];
 } else {
   const courses=await readJSON("courses",[]);
   item=courses.find(c=>c.id===b.itemId&&c.status==="published");
   if(!item) return json({error:"This opportunity is unavailable."},404);
   const closed=courseBookingClosedReason(item);
   if(closed) return json({error:closed},400);
   if(!item.askDietary) b.dietary="";
 }

 try{
   const result=await updateJSON("bookings",[],bookings=>{
     if(!Array.isArray(bookings)) bookings=[];
     if(bookings.some(x=>x.itemId===b.itemId&&x.email===b.email&&activeBooking(x))){
       return {result:{duplicate:true}};
     }
     const capacity=Number(item.capacity)||0;
     const waitingList=capacity>0 && placesTaken(bookings,b.itemId)>=capacity;
     // A full session is refused outright, so the person can pick another.
     if(!waitingList && b.itemType==="eduhub"){
       const full=eduhub.sessions.find(x=>x.capacity>0 && extra.sessionIds.includes(x.id) && sessionPlacesTaken(bookings,x.id)>=x.capacity);
       if(full) return {result:{fullSession:full.title}};
     }
     const now=new Date().toISOString();
     const record={...b,...extra,id:crypto.randomUUID(),reference:makeReference(b.itemType==="eduhub"?"EH27":"PL"),
       itemTitle:item.title,waitingList,cancelled:false,createdAt:now,updatedAt:now};
     bookings.unshift(record);
     return {value:bookings,result:{waitingList,reference:record.reference,id:record.id}};
   });
   if(result.fullSession) return json({error:`Sorry, "${result.fullSession}" has just become full. Please choose a different session.`,fullSession:true},409);
   if(result.duplicate) return json({error:"There is already a booking for this email address. If you need to change it, please contact the organiser."},409);
   const {id,...pub}=result;
   const origin=siteOrigin(request);
   const email=await sendConfirmation(id,origin);
   return json({ok:true,...pub,ticketUrl:result.waitingList?"":ticketUrl(origin,id),emailSent:email.sent});
 }catch(err){
   return json({error:err.message||"Your booking could not be saved. Please try again."},503);
 }
};
