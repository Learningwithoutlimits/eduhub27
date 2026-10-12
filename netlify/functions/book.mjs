import { allergenSummary } from "../../public/assets/allergens.js";
import { json, readJSON, updateJSON, clean, isEmail, STAFF_DOMAIN, normaliseEduhub, eduhubEffectiveStatus,
  courseBookingClosedReason, placesTaken, activeBooking, makeReference, EDUHUB_ID } from "./_utils.mjs";

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
 if(!b.firstName||!b.lastName||!b.email||!b.organisation) return json({error:"Please complete all required fields."},400);
 if(!isEmail(b.email)) return json({error:"Please enter a valid email address."},400);

 let item, extra={};
 if(b.itemType==="eduhub"){
   const eduhub=normaliseEduhub(await readJSON("eduhub",null));
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
     const now=new Date().toISOString();
     const record={...b,...extra,id:crypto.randomUUID(),reference:makeReference(b.itemType==="eduhub"?"EH27":"PL"),
       itemTitle:item.title,waitingList,cancelled:false,createdAt:now,updatedAt:now};
     bookings.unshift(record);
     return {value:bookings,result:{waitingList,reference:record.reference}};
   });
   if(result.duplicate) return json({error:"There is already a booking for this email address. If you need to change it, please contact the organiser."},409);
   return json({ok:true,...result});
 }catch(err){
   return json({error:err.message||"Your booking could not be saved. Please try again."},503);
 }
};
