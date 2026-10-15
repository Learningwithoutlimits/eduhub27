import { json, readJSON, normaliseEduhub, eduhubEffectiveStatus, courseBookingClosedReason, placesTaken, sessionPlacesTaken, EDUHUB_ID } from "./_utils.mjs";

// Only the fields the public site needs. Booking records never leave the server.
const COURSE_FIELDS=["id","title","summary","description","audience","facilitator","venue","cost","capacity","bookingDeadline","cateringType","cateringDetails","askDietary","sessions","date","time","category","status","bookingOpen"];

export default async () => {
 const [courses,bookings,raw]=await Promise.all([readJSON("courses",[]),readJSON("bookings",[]),readJSON("eduhub",null)]);
 const eduhub=normaliseEduhub(raw);
 const placesLeft=(id,capacity)=>Number(capacity)>0?Math.max(0,Number(capacity)-placesTaken(bookings,id)):null;
 const published=courses.filter(c=>c.status==="published").map(c=>{
   const out=Object.fromEntries(COURSE_FIELDS.filter(k=>k in c).map(k=>[k,c[k]]));
   const closed=courseBookingClosedReason(c);
   return {...out,bookable:!closed,closedReason:closed,placesLeft:placesLeft(c.id,c.capacity)};
 });
 const {updatedAt,...publicEduhub}=eduhub;
 publicEduhub.sessions=eduhub.sessions.map(x=>({...x,placesLeft:x.capacity>0?Math.max(0,x.capacity-sessionPlacesTaken(bookings,x.id)):null}));
 publicEduhub.workshops=eduhub.workshops.map(({adminNotes,...w})=>w);
 return json({courses:published,eduhub:{...publicEduhub,effectiveStatus:eduhubEffectiveStatus(eduhub),placesLeft:placesLeft(EDUHUB_ID,eduhub.capacity)}});
};
