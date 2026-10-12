import { json, writeJSON, requireAdmin } from "./_utils.mjs";
export default async request => {
 if(!requireAdmin(request)) return json({error:"Not signed in"},401);
 if(request.method!=="POST") return json({error:"Method not allowed"},405);
 const body=await request.json(); body.capacity=Number(body.capacity)||0; body.foodChoices=Array.isArray(body.foodChoices)?body.foodChoices.filter(Boolean):[]; body.askDietary=Boolean(body.askDietary); body.updatedAt=new Date().toISOString();
 await writeJSON("eduhub",body); return json({ok:true});
};
