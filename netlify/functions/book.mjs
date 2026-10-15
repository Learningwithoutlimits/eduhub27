import { allergenSummary } from "../../public/assets/allergens.js";
import { json, readJSON, updateJSON, clean, isEmail, STAFF_DOMAIN, normaliseEduhub, eduhubEffectiveStatus,
  courseBookingClosedReason, placesTaken, activeBooking, makeReference, EDUHUB_ID,
  slotKey, slotLabel, sessionPlacesTaken, sessionOpenTo, PHASE_NAMES, speakerAccess, todayUK, ATTENDEE_ROLES, isStaffEmail, domainList } from "./_utils.mjs";
import { sendConfirmation, ticketUrl, siteOrigin } from "./_tickets.mjs";

const NO_FOOD = "no-food";

export default async request => {
 if(request.method!=="POST") return json({error:"Method not allowed"},405);
 const raw=await request.json().catch(()=>null);
 if(!raw || typeof raw!=="object") return json({error:"Please complete the booking form."},400);

 // Hidden "website" field: people never see it, so only automated spam fills it in.
 if(clean(raw.website)) return json({ok:true,waitingList:false,reference:""});

 const speaker = raw.itemType==="eduhub-speaker";
 const b={
   itemType: raw.itemType==="eduhub"||speaker ? "eduhub" : "course",
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
 if(speaker){
   // Speakers book lunch through a private link. They need no Trust email,
   // school or workshop choice, and do not use up staff places.
   eduhub=normaliseEduhub(await readJSON("eduhub",null));
   if(!speakerAccess(eduhub,String(raw.code||""))) return json({error:"This speaker booking link is not valid. Please contact the event organiser."},403);
   if(!eduhub.speakerBookingOpen || (eduhub.date && todayUK()>eduhub.date)) return json({error:"Speaker lunch bookings are closed. Please contact the event organiser."},403);
   if(!b.organisation) b.organisation="Speaker";
 }else if(b.itemType==="eduhub"){
   eduhub=normaliseEduhub(await readJSON("eduhub",null));
   b.role=ATTENDEE_ROLES[raw.role]&&raw.role!=="speaker"?raw.role:"staff";
   if(b.role!=="staff" && !eduhub.allowGovernors) return json({error:"EduHub bookings for governors and trustees are not open. Please contact the event organiser."},403);
   if(b.role==="trustee"){
     Object.assign(b,{organisation:"Board of Trustees",phase:"central",schoolId:""});
   }
   // With a school list, the school decides which sessions someone can book.
   else if(eduhub.schools.length){
     const school=eduhub.schools.find(x=>x.id===clean(raw.schoolId,60));
     if(!school) return json({error:"Please choose your school or team from the list."},400);
     Object.assign(b,{schoolId:school.id,organisation:school.name,phase:school.phase});
   }
 }
 if(!b.firstName||!b.lastName||!b.email||!b.organisation) return json({error:"Please complete all required fields."},400);
 if(!isEmail(b.email)) return json({error:"Please enter a valid email address."},400);

 let item, extra={};
 if(speaker){
   if(raw.consent!==true && raw.consent!=="true" && raw.consent!=="on") return json({error:"Please confirm that you have read how we will use your information."},400);
   if(!eduhub.askDietary) b.dietary="";
   if(!eduhub.askAccessibility) b.accessibility="";
   b.itemId=EDUHUB_ID;
   item={...eduhub,id:EDUHUB_ID,capacity:0};
   const leading=clean(raw.leading,160);
   const options=[eduhub.keynote?.name?`Keynote: ${eduhub.keynote.name}`:"",...eduhub.workshops.map(w=>w.speakerName?`${w.title} (${w.speakerName})`:w.title),"Other"].filter(Boolean);
   if(!options.includes(leading)) return json({error:"Please choose the session you are leading."},400);
   extra={role:"speaker",leading};
   if(eduhub.foodChoices.length){
     const chosen=clean(raw.foodChoiceId,80);
     if(chosen===NO_FOOD && eduhub.allowNoFood) Object.assign(extra,{foodChoiceId:NO_FOOD,foodChoice:"No food required",foodAllergens:""});
     else{
       const choice=eduhub.foodChoices.find(c=>c.id===chosen);
       if(!choice) return json({error:"Please choose your food option."},400);
       Object.assign(extra,{foodChoiceId:choice.id,foodChoice:choice.name,foodAllergens:allergenSummary(choice)});
     }
   }
 }else if(b.itemType==="eduhub"){
   const status=eduhubEffectiveStatus(eduhub);
   if(status==="coming-soon") return json({error:"EduHub bookings have not opened yet."},403);
   if(status!=="open") return json({error:"EduHub bookings are now closed."},403);
   if(b.role==="staff" && !isStaffEmail(b.email,eduhub)) return json({error:`Members of staff need to use their ${domainList(eduhub)} email address. Governors and trustees can choose their role at the top of the form.`},400);
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
   // Workshops: one per round, and the same workshop only once.
   const wanted=[...new Set((Array.isArray(raw.sessionIds)?raw.sessionIds:[]).map(x=>clean(x,140)))];
   const eligible=eduhub.sessions.filter(x=>sessionOpenTo(x,b.phase));
   const chosen=[];
   for(const id of wanted){
     const session=eligible.find(x=>x.id===id);
     if(!session) return json({error:"One of the workshops you chose is not in one of your rounds. Please check your choices."},400);
     if(chosen.some(x=>slotKey(x)===slotKey(session))) return json({error:`Please choose only one workshop for ${slotLabel(session)}.`},400);
     if(session.workshopId && chosen.some(x=>x.workshopId===session.workshopId)) return json({error:`You have chosen "${session.title}" more than once. Please choose a different workshop for one of the rounds.`},400);
     chosen.push(session);
   }
   if(eduhub.requireSessionChoice){
     const slots=[...new Set(eligible.map(slotKey))];
     const missing=slots.filter(k=>!chosen.some(x=>slotKey(x)===k));
     if(missing.length){
       const first=eligible.find(x=>slotKey(x)===missing[0]);
       return json({error:`Please choose a workshop for ${slotLabel(first)}.`},400);
     }
   }
   extra.sessionIds=chosen.map(x=>x.id);
   extra.sessions=chosen.map(x=>({id:x.id,title:x.title,time:slotLabel(x),room:x.room,speaker:x.speakerName||""}));
   if(b.phase) extra.phaseName=PHASE_NAMES[b.phase];
   extra.roleName=ATTENDEE_ROLES[b.role];
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
     const waitingList=!speaker && capacity>0 && placesTaken(bookings,b.itemId)>=capacity;
     // A full session is refused outright, so the person can pick another.
     if(!waitingList && b.itemType==="eduhub" && !speaker){
       const full=eduhub.sessions.find(x=>x.capacity>0 && extra.sessionIds.includes(x.id) && sessionPlacesTaken(bookings,x.id)>=x.capacity);
       if(full) return {result:{fullSession:full.title}};
     }
     const now=new Date().toISOString();
     const record={...b,...extra,id:crypto.randomUUID(),reference:makeReference(speaker?"EHS":b.itemType==="eduhub"?"EH27":"PL"),
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
