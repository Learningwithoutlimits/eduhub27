// Administrator actions on a single booking.
import { allergenSummary } from "../../public/assets/allergens.js";
import { json, readJSON, updateJSON, requireAdmin, clean, normaliseEduhub, EDUHUB_ID } from "./_utils.mjs";

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
     case "confirm": b.waitingList=false; b.cancelled=false; break;
     case "waiting": b.waitingList=true; break;
     case "update": {
       const f=body.fields||{};
       for(const [k,max] of [["firstName",80],["lastName",80],["organisation",150],["jobTitle",120],["telephone",40],["dietary",600],["accessibility",600],["notes",1000],["adminNotes",1000]]){
         if(k in f) b[k]=clean(f[k],max);
       }
       if(b.itemId===EDUHUB_ID && "foodChoiceId" in f){
         if(f.foodChoiceId==="no-food"){ Object.assign(b,{foodChoiceId:"no-food",foodChoice:"No food required",foodAllergens:""}); }
         else if(!f.foodChoiceId){ Object.assign(b,{foodChoiceId:"",foodChoice:"",foodAllergens:""}); }
         else{
           const c=eduhub.foodChoices.find(x=>x.id===f.foodChoiceId);
           if(!c) return {result:{error:"That food choice no longer exists.",status:400}};
           Object.assign(b,{foodChoiceId:c.id,foodChoice:c.name,foodAllergens:allergenSummary(c)});
         }
       }
       break;
     }
     default: return {result:{error:"Unknown action.",status:400}};
   }
   b.updatedAt=now;
   return {value:bookings,result:{booking:b}};
 });
 if(result.error) return json({error:result.error},result.status);
 return json({ok:true,booking:result.booking});
};
