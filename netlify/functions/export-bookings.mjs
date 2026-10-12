import { readJSON, requireAdmin } from "./_utils.mjs";
const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
export default async request => {
 if(!requireAdmin(request)) return new Response("Not signed in",{status:401});
 const rows=await readJSON("bookings",[]);
 const headers=["Date booked","Type","Opportunity","First name","Surname","Email","Telephone","Organisation","Job title","Food choice","Dietary requirements","Accessibility requirements","Notes","Status"];
 const lines=[headers.map(esc).join(","),...rows.map(b=>[b.createdAt,b.itemType,b.itemTitle,b.firstName,b.lastName,b.email,b.telephone,b.organisation,b.jobTitle,b.foodChoice,b.dietary,b.accessibility,b.notes,b.waitingList?"Waiting list":"Booked"].map(esc).join(","))];
 return new Response("\ufeff"+lines.join("\n"),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="lwlat-bookings-${new Date().toISOString().slice(0,10)}.csv"`}});
};
