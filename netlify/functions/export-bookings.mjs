import { readJSON, requireAdmin, bookingStatusOf, activeBooking, EDUHUB_ID, normaliseEduhub, slotLabel } from "./_utils.mjs";

// Excel treats cells beginning with = + - @ as formulas. Booking details come
// from the public, so prefix those with an apostrophe to keep them as text.
const safe=v=>{const s=String(v??""); return /^[=+\-@\t\r]/.test(s)?"'"+s:s};
const esc=v=>`"${safe(v).replaceAll('"','""')}"`;
const STATUS={booked:"Booked",waiting:"Waiting list",cancelled:"Cancelled"};
const stamp=v=>v?new Date(v).toLocaleString("en-GB",{timeZone:"Europe/London"}):"";

export default async request => {
 if(!requireAdmin(request)) return new Response("Not signed in",{status:401});
 const url=new URL(request.url);
 const item=url.searchParams.get("item")||"";
 const view=url.searchParams.get("view")||"full";
 let rows=await readJSON("bookings",[]);
 if(item==="eduhub") rows=rows.filter(b=>b.itemId===EDUHUB_ID);
 else if(item==="courses") rows=rows.filter(b=>b.itemId!==EDUHUB_ID);
 else if(item) rows=rows.filter(b=>b.itemId===item);

 let headers, lines, label=view==="catering"?"catering":"bookings";
 const sessionList=b=>(Array.isArray(b.sessions)?b.sessions:[]).map(x=>`${x.time}: ${x.title}${x.room?` (${x.room})`:""}`).join("; ");
 if(view==="register"){
   // Attendance register for one session: confirmed places only.
   const eduhub=normaliseEduhub(await readJSON("eduhub",null));
   const session=eduhub.sessions.find(x=>x.id===url.searchParams.get("session"));
   if(!session) return new Response("Session not found",{status:404});
   rows=rows.filter(b=>b.itemId===EDUHUB_ID&&activeBooking(b)&&!b.waitingList&&Array.isArray(b.sessionIds)&&b.sessionIds.includes(session.id))
     .sort((a,b)=>String(a.lastName).localeCompare(String(b.lastName)));
   headers=["Workshop","Round and time","Room or area","Reference","Type","First name","Surname","School or team","Dietary requirements or allergies","Accessibility requirements","Arrived at event"];
   lines=rows.map(b=>[session.title,slotLabel(session),session.room,b.reference,b.roleName||"Member of staff",b.firstName,b.lastName,b.organisation,b.dietary,b.accessibility,b.checkedInAt?"Yes":""]);
   label=`register-${session.id}`;
 }else if(view==="catering"){
   // For the caterer: confirmed places only, food and dietary details, no contact details.
   rows=rows.filter(b=>activeBooking(b)&&!b.waitingList).sort((a,b)=>String(a.foodChoice||"").localeCompare(String(b.foodChoice||""))||String(a.lastName).localeCompare(String(b.lastName)));
   headers=["Reference","Type","First name","Surname","School or organisation","Food choice","Allergens in chosen food","Dietary requirements or allergies"];
   lines=rows.map(b=>[b.reference,b.role==="speaker"?"Speaker":b.role==="governor"?"Governor":b.role==="trustee"?"Trustee":"Staff",b.firstName,b.lastName,b.organisation,b.foodChoice,b.foodAllergens,b.dietary]);
 }else{
   headers=["Reference","Date booked","Type","Opportunity","First name","Surname","Email","Telephone","School or organisation","Phase","Job title","Sessions","Food choice","Allergens in chosen food","Dietary requirements or allergies","Accessibility requirements","Notes","Admin notes","Status","Checked in","Email sent"];
   lines=rows.map(b=>[b.reference,stamp(b.createdAt),b.role==="speaker"?`EduHub speaker (${b.leading||""})`:b.role==="governor"?"EduHub governor":b.role==="trustee"?"EduHub trustee":b.itemType==="eduhub"?"EduHub":"Professional Learning",b.itemTitle,b.firstName,b.lastName,b.email,b.telephone,b.organisation,b.phaseName,b.jobTitle,sessionList(b),b.foodChoice,b.foodAllergens,b.dietary,b.accessibility,b.notes,b.adminNotes,STATUS[bookingStatusOf(b)],stamp(b.checkedInAt),b.emailSentAt?stamp(b.emailSentAt):b.emailError?"Failed":""]);
 }
 const csv=[headers,...lines].map(r=>r.map(esc).join(",")).join("\r\n");
 const name=`lwlat-${label}${item&&view!=="register"?"-"+item.replace(/[^a-z0-9-]/gi,"").slice(0,40):""}-${new Date().toISOString().slice(0,10)}.csv`;
 return new Response("﻿"+csv,{headers:{"content-type":"text/csv; charset=utf-8","cache-control":"no-store","content-disposition":`attachment; filename="${name}"`}});
};
