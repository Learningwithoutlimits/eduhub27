import { json, readJSON, updateJSON, requireAdmin, slug, clean, isDate, COURSE_STATUSES, CATERING_TYPES } from "./_utils.mjs";

function sanitise(body){
 const sessions=(Array.isArray(body.sessions)?body.sessions:[]).slice(0,30).map((s,i)=>({
   label:clean(s?.label,80)||`Session ${i+1}`, date:isDate(s?.date)?s.date:"", time:clean(s?.time,60)
 })).filter(s=>s.date||s.time);
 return {
   title:clean(body.title,150), summary:clean(body.summary,600), description:clean(body.description,5000),
   audience:clean(body.audience,150), facilitator:clean(body.facilitator,150), venue:clean(body.venue,200),
   cost:clean(body.cost,60), category:clean(body.category,80),
   capacity:Math.max(0,Math.floor(Number(body.capacity)||0)),
   bookingDeadline:isDate(body.bookingDeadline)?body.bookingDeadline:"",
   cateringType:CATERING_TYPES.includes(body.cateringType)?body.cateringType:"none",
   cateringDetails:clean(body.cateringDetails,200), askDietary:Boolean(body.askDietary),
   status:COURSE_STATUSES.includes(body.status)?body.status:"draft",
   bookingOpen:body.bookingOpen!==false && body.bookingOpen!=="false",
   sessions, date:sessions[0]?.date||"", time:sessions[0]?.time||""
 };
}

export default async request => {
 if(!requireAdmin(request)) return json({error:"Not signed in"},401);
 const body=await request.json().catch(()=>({}));
 if(request.method==="DELETE"){
   await updateJSON("courses",[],courses=>({value:courses.filter(c=>c.id!==body.id),result:null}));
   return json({ok:true});
 }
 if(request.method!=="POST") return json({error:"Method not allowed"},405);
 const fields=sanitise(body);
 if(!fields.title) return json({error:"A title is required."},400);
 const now=new Date().toISOString(); const id=clean(body.id,120)||`${slug(fields.title)}-${Date.now().toString(36)}`;
 const item=await updateJSON("courses",[],courses=>{
   const index=courses.findIndex(c=>c.id===id);
   const saved=index>=0?{...courses[index],...fields,id,updatedAt:now}:{...fields,id,createdAt:now,updatedAt:now};
   if(index>=0) courses[index]=saved; else courses.unshift(saved);
   return {value:courses,result:saved};
 });
 return json({ok:true,item});
};
