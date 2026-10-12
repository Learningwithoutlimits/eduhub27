import { json, readJSON, writeJSON, defaults } from "./_utils.mjs";
export default async request => {
 if(request.method!=="POST") return json({error:"Method not allowed"},405);
 const b=await request.json().catch(()=>({}));
 for(const f of ["firstName","lastName","email","organisation","itemType","itemId"]) if(!String(b[f]||"").trim()) return json({error:"Please complete all required fields."},400);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return json({error:"Please enter a valid email address."},400);
 const courses=await readJSON("courses",[]); const eduhub=await readJSON("eduhub",defaults.eduhub);
 let item;
 if(b.itemType==="eduhub"){
   if(!b.email.toLowerCase().endsWith("@lwlat.org.uk")) return json({error:"EduHub 2027 is for LwLAT staff. Please use your @lwlat.org.uk email address."},400);
   item={...eduhub,id:"eduhub-2027"};
 } else {
   item=courses.find(c=>c.id===b.itemId&&c.status==="published");
   if(!item) return json({error:"This opportunity is unavailable."},404);
 }
 if(item.bookingOpen===false) return json({error:"Bookings are closed for this opportunity."},400);
 const bookings=await readJSON("bookings",[]);
 const count=bookings.filter(x=>x.itemId===b.itemId&&!x.cancelled&&!x.waitingList).length;
 const waitingList=Number(item.capacity)>0 && count>=Number(item.capacity);
 const record={...b,id:crypto.randomUUID(),email:b.email.toLowerCase().trim(),itemTitle:item.title,waitingList,createdAt:new Date().toISOString()};
 bookings.unshift(record); await writeJSON("bookings",bookings);
 return json({ok:true,waitingList});
};
