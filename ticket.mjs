// Ticket page data and scan-in. Anyone with a valid ticket link sees the
// ticket. A signed-in administrator who opens it can check the person in.
import { json, readJSON, updateJSON, requireAdmin, normaliseEduhub, EDUHUB_ID, bookingStatusOf } from "./_utils.mjs";
import { validTicket } from "./_tickets.mjs";

export default async request => {
 const url = new URL(request.url);
 const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
 const id = String(body.b || url.searchParams.get("b") || "");
 const sig = String(body.s || url.searchParams.get("s") || "");
 if(!validTicket(id, sig)) return json({ error: "This ticket link is not valid." }, 404);
 const admin = requireAdmin(request);

 if(request.method === "POST"){
   if(!admin) return json({ error: "Please sign in to the admin area to check people in." }, 401);
   const action = body.action === "undo" ? "undo" : "checkin";
   const result = await updateJSON("bookings", [], list => {
     const b = list.find(x => x.id === id);
     if(!b) return { result: { error: "This booking no longer exists.", status: 404 } };
     const status = bookingStatusOf(b);
     if(action === "undo"){ delete b.checkedInAt; return { value: list, result: { booking: b } }; }
     if(b.checkedInAt) return { result: { booking: b, already: true } };
     if(status === "cancelled") return { result: { booking: b, error: "This booking was cancelled.", status: 409 } };
     if(status === "waiting" && body.force !== true) return { result: { booking: b, error: "This person is on the waiting list and does not have a confirmed place.", status: 409, canForce: true } };
     b.checkedInAt = new Date().toISOString();
     return { value: list, result: { booking: b } };
   });
   if(result.error) return json({ error: result.error, canForce: Boolean(result.canForce) }, result.status);
   return json({ ok: true, already: Boolean(result.already), checkedInAt: result.booking.checkedInAt || "" });
 }

 const b = (await readJSON("bookings", [])).find(x => x.id === id);
 if(!b) return json({ error: "This booking no longer exists." }, 404);
 const eduhub = normaliseEduhub(await readJSON("eduhub", null));
 const course = b.itemId === EDUHUB_ID ? null : (await readJSON("courses", [])).find(c => c.id === b.itemId);
 const event = b.itemId === EDUHUB_ID
   ? { date: eduhub.date, time: eduhub.time, venue: eduhub.venue }
   : { date: course?.sessions?.[0]?.date || course?.date || "", time: course?.sessions?.[0]?.time || course?.time || "", venue: course?.venue || "" };
 const out = { reference: b.reference, firstName: b.firstName, itemTitle: b.itemTitle, status: bookingStatusOf(b), event,
   sessions: (b.sessions || []).map(s => ({ title: s.title, time: s.time, room: s.room })), isAdmin: admin };
 if(admin) Object.assign(out, { lastName: b.lastName, organisation: b.organisation, phaseName: b.phaseName || "", foodChoice: b.foodChoice || "",
   dietary: b.dietary || "", accessibility: b.accessibility || "", checkedInAt: b.checkedInAt || "" });
 return json(out);
};
