import { json, readJSON, defaults } from "./_utils.mjs";
export default async () => {
 const courses=await readJSON("courses",[]);
 const eduhub=await readJSON("eduhub",defaults.eduhub);
 return json({courses:courses.filter(c=>c.status==="published"),eduhub});
};
