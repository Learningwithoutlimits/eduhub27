import { json, requireAdmin } from "./_utils.mjs";
export default async request => requireAdmin(request)?json({ok:true}):json({error:"Not signed in"},401);
