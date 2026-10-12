import { json, readJSON, writeJSON, requireAdmin, slug } from "./_utils.mjs";
export default async request => {
 if(!requireAdmin(request)) return json({error:"Not signed in"},401);
 const courses=await readJSON("courses",[]);
 const body=await request.json().catch(()=>({}));
 if(request.method==="DELETE"){
   await writeJSON("courses",courses.filter(c=>c.id!==body.id)); return json({ok:true});
 }
 if(request.method!=="POST") return json({error:"Method not allowed"},405);
 if(!body.title?.trim()) return json({error:"A title is required."},400);
 const now=new Date().toISOString(); const id=body.id||`${slug(body.title)}-${Date.now().toString(36)}`;
 const item={...body,id,title:body.title.trim(),capacity:Number(body.capacity)||0,bookingOpen:body.bookingOpen!==false,askDietary:Boolean(body.askDietary),sessions:Array.isArray(body.sessions)?body.sessions:[],updatedAt:now};
 const index=courses.findIndex(c=>c.id===id);
 if(index>=0) courses[index]={...courses[index],...item}; else courses.unshift({...item,createdAt:now});
 await writeJSON("courses",courses); return json({ok:true,item});
};
