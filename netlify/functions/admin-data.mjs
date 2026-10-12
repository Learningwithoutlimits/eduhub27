import { json, readJSON, defaults, requireAdmin } from "./_utils.mjs";
export default async request => {
 if(!requireAdmin(request)) return json({error:"Not signed in"},401);
 return json({courses:await readJSON("courses",[]),bookings:await readJSON("bookings",[]),eduhub:await readJSON("eduhub",defaults.eduhub)});
};
