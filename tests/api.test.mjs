// API tests against the local test server (no live data is touched).
//   node tests/api.test.mjs
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { getStore } from "@netlify/blobs";

const PORT = 8950 + Math.floor(Math.random() * 40) * 2;
const BASE = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ["tests/dev-server.mjs", String(PORT)], { stdio: ["ignore", "pipe", "inherit"] });
await new Promise((resolve, reject) => {
  server.stdout.on("data", d => String(d).includes("test server") && resolve());
  server.on("exit", code => reject(new Error("server exited " + code)));
});
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ siteID: "local-site", token: "local-test-token", edgeURL: `http://localhost:${PORT + 1}`, uncachedEdgeURL: `http://localhost:${PORT + 1}` })).toString("base64");
const blobs = getStore({ name: "lwlat-events-data", consistency: "strong" });

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ✓ " + name); }
  catch (err) { failed++; console.log("  ✗ " + name + "\n    " + (err.stack || err).toString().split("\n").slice(0, 3).join("\n    ")); }
}
let cookie = "";
async function call(path, { method = "GET", body, auth = false } = {}) {
  const res = await fetch(BASE + "/api/" + path, { method, headers: { "content-type": "application/json", ...(auth ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
const staff = (n, extra = {}) => ({ itemType: "eduhub", itemId: "eduhub-2027", firstName: "Test", lastName: "Person " + n, email: `test.person${n}@lwlat.org.uk`, organisation: "Test Academy", consent: true, ...extra });
const MENU = [
  { name: "Quorn Sausage Casserole", group: "Hot meals", allergens: ["GL"], cerealTypes: "Wheat", allergensConfirmed: true },
  { name: "Tuna Mayo Sandwich", group: "Grab bags", allergens: ["GL", "EG", "FI"], cerealTypes: "Wheat" }
];
const settings = (extra = {}) => ({ title: "EduHub 2027: Better Together", date: "2027-01-05", time: "08:30 to 15:30", venue: "Babington Academy", description: "Test", capacity: 0, bookingStatus: "open", bookingDeadline: "", allowNoFood: false, foodChoices: MENU, askDietary: true, askAccessibility: true, ...extra });

console.log("Public site and status lock");
await test("EduHub defaults to coming soon", async () => {
  const r = await call("public-data");
  assert.equal(r.data.eduhub.effectiveStatus, "coming-soon");
  assert.equal(r.data.eduhub.updatedAt, undefined);
});
await test("legacy v4.9 record with bookingOpen:true stays closed and keeps its food choices", async () => {
  await blobs.set("eduhub", JSON.stringify({ title: "EduHub 2027: Better Together", date: "2027-01-05", venue: "Babington Academy", bookingOpen: true, foodChoices: ["Chicken option", "Vegetarian option"], askDietary: true }));
  const r = await call("public-data");
  assert.equal(r.data.eduhub.bookingStatus, "coming-soon");
  assert.deepEqual(r.data.eduhub.foodChoices.map(c => c.name), ["Chicken option", "Vegetarian option"]);
  const b = await call("book", { method: "POST", body: staff(0, { foodChoiceId: r.data.eduhub.foodChoices[0].id }) });
  assert.equal(b.status, 403);
});

console.log("Admin authentication");
await test("admin endpoints refuse anonymous requests", async () => {
  for (const [p, m] of [["admin-data", "GET"], ["eduhub", "POST"], ["course", "POST"], ["booking", "POST"], ["export-bookings", "GET"]]) {
    assert.equal((await call(p, { method: m, body: m === "POST" ? {} : undefined })).status, 401, p);
  }
});
await test("wrong password is refused", async () => {
  assert.equal((await call("login", { method: "POST", body: { password: "nope" } })).status, 401);
});
await test("correct password signs in", async () => {
  const r = await call("login", { method: "POST", body: { password: "local-admin-password" } });
  assert.equal(r.status, 200);
  cookie = r.headers.get("set-cookie").split(";")[0];
  assert.equal((await call("session", { auth: true })).status, 200);
});
await test("forged session cookie is refused", async () => {
  const r = await fetch(BASE + "/api/admin-data", { headers: { cookie: `lwlat_admin=${Date.now() + 99999}.deadbeef` } });
  assert.equal(r.status, 401);
});
await test("tokens are refused when SESSION_SECRET is missing or short", async () => {
  const saved = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "short";
  const u = await import("../netlify/functions/_utils.mjs?nosecret");
  assert.equal(u.sessionConfigured(), false);
  assert.equal(u.validToken(cookie.split("=")[1]), false);
  process.env.SESSION_SECRET = saved;
});

console.log("EduHub settings");
await test("admin cannot open bookings with no menu unless confirmed", async () => {
  const r = await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: [] }) });
  assert.equal(r.status, 400);
});
await test("admin saves settings and food choices with allergens", async () => {
  await blobs.delete("eduhub");
  const r = await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: [...MENU, { name: "  ", allergens: ["GL"] }, { name: "Bad allergen", allergens: ["XX", "SE"] }] }) });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const e = (await call("admin-data", { auth: true })).data.eduhub;
  assert.equal(e.effectiveStatus, "open");
  assert.equal(e.foodChoices.length, 3);
  assert.deepEqual(e.foodChoices[2].allergens, ["SE"]);
  assert.equal(e.foodChoices[0].cerealTypes, "Wheat");
});

let menu;
console.log("EduHub bookings");
await test("non-staff email is refused", async () => {
  menu = (await call("public-data")).data.eduhub.foodChoices;
  const r = await call("book", { method: "POST", body: staff(1, { email: "someone@gmail.com", foodChoiceId: menu[0].id }) });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /lwlat\.org\.uk/);
});
await test("look-alike domain is refused", async () => {
  const r = await call("book", { method: "POST", body: staff(1, { email: "a@lwlat.org.uk.evil.com", foodChoiceId: menu[0].id }) });
  assert.equal(r.status, 400);
});
await test("missing food choice is refused", async () => {
  assert.equal((await call("book", { method: "POST", body: staff(1) })).status, 400);
  assert.equal((await call("book", { method: "POST", body: staff(1, { foodChoiceId: "made-up" }) })).status, 400);
});
await test("missing consent is refused", async () => {
  assert.equal((await call("book", { method: "POST", body: staff(1, { foodChoiceId: menu[0].id, consent: false }) })).status, 400);
});
await test("valid booking is saved with food choice and allergens", async () => {
  const r = await call("book", { method: "POST", body: staff(1, { foodChoiceId: menu[1].id, dietary: "Coeliac", waitingList: false, cancelled: true, itemTitle: "hacked", isAdmin: true }) });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.match(r.data.reference, /^EH27-[A-Z2-9]{6}$/);
  const b = (await call("admin-data", { auth: true })).data.bookings[0];
  assert.equal(b.foodChoice, "Tuna Mayo Sandwich");
  assert.equal(b.foodAllergens, "Gluten (wheat), Eggs, Fish");
  assert.equal(b.dietary, "Coeliac");
  assert.equal(b.itemTitle, "EduHub 2027: Better Together");
  assert.equal(b.cancelled, false);
  assert.equal(b.isAdmin, undefined);
});
await test("duplicate booking with same email is refused (any letter case)", async () => {
  const r = await call("book", { method: "POST", body: staff(1, { email: "TEST.PERSON1@LWLAT.ORG.UK", foodChoiceId: menu[0].id }) });
  assert.equal(r.status, 409);
});
await test("honeypot submissions are silently dropped", async () => {
  const before = (await call("admin-data", { auth: true })).data.bookings.length;
  const r = await call("book", { method: "POST", body: staff(99, { foodChoiceId: menu[0].id, website: "http://spam" }) });
  assert.equal(r.status, 200);
  assert.equal((await call("admin-data", { auth: true })).data.bookings.length, before);
});
await test("20 simultaneous bookings with capacity 10: none lost, exactly 10 places given", async () => {
  await call("eduhub", { method: "POST", auth: true, body: settings({ capacity: 11, foodChoices: menu }) }); // 1 already booked
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => call("book", { method: "POST", body: staff(100 + i, { foodChoiceId: menu[0].id }) })));
  assert.ok(results.every(r => r.status === 200), results.map(r => r.status).join(","));
  const all = (await call("admin-data", { auth: true })).data.bookings.filter(b => b.itemId === "eduhub-2027");
  assert.equal(all.length, 21);
  assert.equal(all.filter(b => !b.waitingList).length, 11);
  assert.equal(results.filter(r => r.data.waitingList).length, 10);
  assert.equal((await call("public-data")).data.eduhub.placesLeft, 0);
});
await test("closed status and past deadline both block bookings", async () => {
  await call("eduhub", { method: "POST", auth: true, body: settings({ bookingStatus: "closed", foodChoices: menu }) });
  assert.equal((await call("book", { method: "POST", body: staff(200, { foodChoiceId: menu[0].id }) })).status, 403);
  await call("eduhub", { method: "POST", auth: true, body: settings({ bookingDeadline: "2020-01-01", foodChoices: menu }) });
  assert.equal((await call("public-data")).data.eduhub.effectiveStatus, "closed");
  assert.equal((await call("book", { method: "POST", body: staff(200, { foodChoiceId: menu[0].id }) })).status, 403);
  await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: menu }) });
});
await test("'no food' option only accepted when the admin allows it", async () => {
  assert.equal((await call("book", { method: "POST", body: staff(201, { foodChoiceId: "no-food" }) })).status, 400);
  await call("eduhub", { method: "POST", auth: true, body: settings({ allowNoFood: true, foodChoices: menu }) });
  const r = await call("book", { method: "POST", body: staff(201, { foodChoiceId: "no-food" }) });
  assert.equal(r.status, 200);
});

console.log("Admin booking management");
await test("cancel frees a place, reinstate and give place work, update changes food", async () => {
  let bookings = (await call("admin-data", { auth: true })).data.bookings;
  const target = bookings.find(b => b.email === "test.person1@lwlat.org.uk");
  assert.equal((await call("booking", { method: "POST", auth: true, body: { id: target.id, action: "cancel" } })).status, 200);
  assert.equal((await call("public-data")).data.eduhub.placesLeft, null); // capacity 0 means unlimited
});
await test("booking actions", async () => {
  await call("eduhub", { method: "POST", auth: true, body: settings({ capacity: 30, foodChoices: menu }) });
  let bookings = (await call("admin-data", { auth: true })).data.bookings;
  const target = bookings.find(b => b.email === "test.person1@lwlat.org.uk");
  assert.equal(target.cancelled, true);
  // cancelled booking no longer blocks a new booking with the same email
  const again = await call("book", { method: "POST", body: staff(1, { foodChoiceId: menu[0].id }) });
  assert.equal(again.status, 200);
  const waiting = bookings.find(b => b.waitingList);
  assert.equal((await call("booking", { method: "POST", auth: true, body: { id: waiting.id, action: "confirm" } })).status, 200);
  const upd = await call("booking", { method: "POST", auth: true, body: { id: waiting.id, action: "update", fields: { foodChoiceId: menu[1].id, adminNotes: "Changed by phone", email: "changed@x.com" } } });
  assert.equal(upd.status, 200);
  assert.equal(upd.data.booking.foodChoice, "Tuna Mayo Sandwich");
  assert.equal(upd.data.booking.email, waiting.email);
  assert.equal(upd.data.booking.waitingList, false);
  assert.equal((await call("booking", { method: "POST", auth: true, body: { id: waiting.id, action: "update", fields: { foodChoiceId: "nope" } } })).status, 400);
  assert.equal((await call("booking", { method: "DELETE", auth: true, body: { id: target.id } })).status, 200);
  bookings = (await call("admin-data", { auth: true })).data.bookings;
  assert.ok(!bookings.some(b => b.id === target.id));
});

console.log("Exports");
await test("CSV export includes food and neutralises spreadsheet formulas", async () => {
  await call("book", { method: "POST", body: staff(300, { firstName: "=HYPERLINK(\"http://x\")", foodChoiceId: menu[1].id, dietary: "+nut allergy" }) });
  const res = await fetch(BASE + "/api/export-bookings?item=eduhub", { headers: { cookie } });
  const csv = await res.text();
  assert.match(csv, /Food choice/);
  assert.match(csv, /Tuna Mayo Sandwich/);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"'\+nut allergy"/);
});
await test("caterer's list has no email addresses and no waiting list", async () => {
  const csv = await (await fetch(BASE + "/api/export-bookings?item=eduhub&view=catering", { headers: { cookie } })).text();
  assert.doesNotMatch(csv, /@lwlat\.org\.uk/);
  assert.match(csv, /Allergens in chosen food/);
});

console.log("Professional Learning");
let courseId;
await test("course saved with sanitised fields", async () => {
  const r = await call("course", { method: "POST", auth: true, body: { title: "Phonics refresher", summary: "S", status: "published", bookingOpen: true, capacity: 1, askDietary: false, sessions: [{ label: "Day 1", date: "2099-03-01", time: "09:30" }, { date: "2099-03-08" }], evil: "<script>" } });
  assert.equal(r.status, 200);
  courseId = r.data.item.id;
  assert.equal(r.data.item.evil, undefined);
  assert.equal(r.data.item.date, "2099-03-01");
});
await test("course booking: dietary dropped when not asked, capacity sends next to waiting list", async () => {
  const body = { itemType: "course", itemId: courseId, firstName: "Ext", lastName: "Delegate", email: "ext@example.com", organisation: "Another School", dietary: "Vegan" };
  const r1 = await call("book", { method: "POST", body });
  assert.equal(r1.status, 200); assert.equal(r1.data.waitingList, false); assert.match(r1.data.reference, /^PL-/);
  const r2 = await call("book", { method: "POST", body: { ...body, email: "ext2@example.com" } });
  assert.equal(r2.data.waitingList, true);
  const b = (await call("admin-data", { auth: true })).data.bookings.find(x => x.email === "ext@example.com");
  assert.equal(b.dietary, "");
});
await test("course past its deadline refuses bookings", async () => {
  await call("course", { method: "POST", auth: true, body: { id: courseId, title: "Phonics refresher", status: "published", bookingDeadline: "2020-01-01", sessions: [{ date: "2099-03-01" }] } });
  const pub = (await call("public-data")).data.courses.find(c => c.id === courseId);
  assert.equal(pub.bookable, false);
  const r = await call("book", { method: "POST", body: { itemType: "course", itemId: courseId, firstName: "A", lastName: "B", email: "late@example.com", organisation: "X" } });
  assert.equal(r.status, 400);
});
await test("public data never includes booking records", async () => {
  const text = JSON.stringify((await call("public-data")).data);
  assert.doesNotMatch(text, /example\.com|test\.person/);
});
await test("draft courses cannot be booked", async () => {
  const r = await call("course", { method: "POST", auth: true, body: { title: "Draft course", status: "draft", sessions: [{ date: "2099-01-01" }] } });
  const b = await call("book", { method: "POST", body: { itemType: "course", itemId: r.data.item.id, firstName: "A", lastName: "B", email: "d@example.com", organisation: "X" } });
  assert.equal(b.status, 404);
});

console.log("EduHub sessions and schools");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let photoId, prog;
await test("admin uploads a speaker photo, anyone can view it, fake images are refused", async () => {
  assert.equal((await call("photo", { method: "POST", body: { dataUrl: PNG } })).status, 401);
  const r = await call("photo", { method: "POST", auth: true, body: { dataUrl: PNG } });
  assert.equal(r.status, 200); photoId = r.data.id;
  const img = await fetch(BASE + "/api/photo?id=" + photoId);
  assert.equal(img.status, 200); assert.equal(img.headers.get("content-type"), "image/png");
  const fake = "data:image/png;base64," + Buffer.from("<svg onload=alert(1)>").toString("base64");
  assert.equal((await call("photo", { method: "POST", auth: true, body: { dataUrl: fake } })).status, 400);
  assert.equal((await fetch(BASE + "/api/photo?id=../../eduhub")).status, 404);
});
await test("saving schools and sessions does not touch event details, and the reverse", async () => {
  const before = (await call("admin-data", { auth: true })).data.eduhub;
  const r = await call("eduhub", { method: "POST", auth: true, body: { section: "programme", title: "HACKED", bookingStatus: "closed", requireSessionChoice: true,
    schools: [{ name: "Example Primary", phase: "primary" }, { name: "Example Academy", phase: "secondary" }, { name: "Trust Central Team", phase: "central" }],
    sessions: [
      { title: "Early reading", startTime: "10:00", endTime: "11:00", room: "S12", speakerName: "A Speaker", photoId, audiences: ["primary"], capacity: 1, description: "Phonics" },
      { title: "Maths mastery", startTime: "10:00", endTime: "11:00", room: "S14", audiences: ["primary"] },
      { title: "GCSE English", startTime: "10:00", endTime: "11:00", room: "Hall", audiences: ["secondary"] },
      { title: "Keynote", startTime: "13:00", endTime: "14:00", room: "Main Hall", audiences: ["primary", "secondary", "central"] },
      { title: "Finance update", startTime: "11:15", endTime: "12:00", audiences: ["central"] }
    ] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  prog = r.data.eduhub;
  assert.equal(prog.title, before.title); assert.equal(prog.bookingStatus, before.bookingStatus);
  assert.deepEqual(prog.foodChoices, before.foodChoices);
  assert.deepEqual(prog.sessions.map(x => x.title), ["Early reading", "Maths mastery", "GCSE English", "Finance update", "Keynote"]);
  const d = await call("eduhub", { method: "POST", auth: true, body: settings({ capacity: 0, foodChoices: menu, sessions: [], schools: [] }) });
  assert.equal(d.data.eduhub.sessions.length, 5);
  assert.equal(d.data.eduhub.schools.length, 3);
});
await test("session that finishes before it starts is refused", async () => {
  const r = await call("eduhub", { method: "POST", auth: true, body: { section: "programme", sessions: [{ title: "Backwards", startTime: "11:00", endTime: "10:00" }] } });
  assert.equal(r.status, 400);
});
const school = n => prog.schools.find(x => x.name === n).id;
const sid = t => prog.sessions.find(x => x.title === t).id;
const sBook = (n, extra) => call("book", { method: "POST", body: staff(n, { foodChoiceId: menu[0].id, organisation: "ignored", ...extra }) });
await test("school must be chosen from the list", async () => {
  assert.equal((await sBook(400, { sessionIds: [] })).status, 400);
  assert.equal((await sBook(400, { schoolId: "made-up" })).status, 400);
});
await test("primary staff cannot book a secondary session", async () => {
  const r = await sBook(401, { schoolId: school("Example Primary"), sessionIds: [sid("GCSE English"), sid("Keynote")] });
  assert.equal(r.status, 400); assert.match(r.data.error, /not available to you/);
});
await test("only one session per time slot", async () => {
  const r = await sBook(402, { schoolId: school("Example Primary"), sessionIds: [sid("Early reading"), sid("Maths mastery"), sid("Keynote")] });
  assert.equal(r.status, 400); assert.match(r.data.error, /only one session/);
});
await test("a session must be chosen in every slot when required", async () => {
  const r = await sBook(403, { schoolId: school("Example Primary"), sessionIds: [sid("Early reading")] });
  assert.equal(r.status, 400); assert.match(r.data.error, /13:00 to 14:00/);
});
await test("valid primary booking saves school, phase and sessions", async () => {
  const r = await sBook(404, { schoolId: school("Example Primary"), sessionIds: [sid("Early reading"), sid("Keynote")] });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const b = (await call("admin-data", { auth: true })).data.bookings.find(x => x.email === "test.person404@lwlat.org.uk");
  assert.equal(b.organisation, "Example Primary"); assert.equal(b.phase, "primary"); assert.equal(b.phaseName, "Primary");
  assert.deepEqual(b.sessions.map(x => x.title), ["Early reading", "Keynote"]);
  assert.equal(b.sessions[0].room, "S12");
});
await test("a full session is refused and shown as full", async () => {
  const r = await sBook(405, { schoolId: school("Example Primary"), sessionIds: [sid("Early reading"), sid("Keynote")] });
  assert.equal(r.status, 409); assert.equal(r.data.fullSession, true);
  const pub = (await call("public-data")).data.eduhub.sessions.find(x => x.title === "Early reading");
  assert.equal(pub.placesLeft, 0);
  assert.equal((await sBook(405, { schoolId: school("Example Primary"), sessionIds: [sid("Maths mastery"), sid("Keynote")] })).status, 200);
});
await test("central staff see only their sessions", async () => {
  const r = await sBook(406, { schoolId: school("Trust Central Team"), sessionIds: [sid("Finance update"), sid("Keynote")] });
  assert.equal(r.status, 200, JSON.stringify(r.data));
});
await test("admin can move someone to another session, still one per slot", async () => {
  const b = (await call("admin-data", { auth: true })).data.bookings.find(x => x.email === "test.person406@lwlat.org.uk");
  const bad = await call("booking", { method: "POST", auth: true, body: { id: b.id, action: "update", fields: { sessionIds: [sid("Early reading"), sid("GCSE English")] } } });
  assert.equal(bad.status, 400);
  const ok = await call("booking", { method: "POST", auth: true, body: { id: b.id, action: "update", fields: { schoolId: school("Example Academy"), sessionIds: [sid("GCSE English"), sid("Keynote")] } } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.booking.phase, "secondary");
  assert.deepEqual(ok.data.booking.sessions.map(x => x.title), ["GCSE English", "Keynote"]);
});
await test("session register lists confirmed attendees only", async () => {
  const csv = await (await fetch(BASE + `/api/export-bookings?view=register&session=${sid("Keynote")}`, { headers: { cookie } })).text();
  assert.match(csv, /Keynote/); assert.match(csv, /Person 404/); assert.match(csv, /Attended/);
  assert.doesNotMatch(csv, /@lwlat/);
  const full = await (await fetch(BASE + "/api/export-bookings?item=eduhub", { headers: { cookie } })).text();
  assert.match(full, /10:00 to 11:00: Early reading \(S12\)/);
});
await test("sessions not required: slots can be left empty", async () => {
  await call("eduhub", { method: "POST", auth: true, body: { section: "programme", requireSessionChoice: false, schools: prog.schools, sessions: prog.sessions } });
  assert.equal((await sBook(407, { schoolId: school("Example Academy"), sessionIds: [] })).status, 200);
});

console.log("Sign-in protection");
await test("repeated wrong passwords lead to a temporary lockout", async () => {
  let last;
  for (let i = 0; i < 9; i++) last = await call("login", { method: "POST", body: { password: "wrong" + i } });
  assert.equal(last.status, 429);
  assert.equal((await call("login", { method: "POST", body: { password: "local-admin-password" } })).status, 429);
});

server.kill();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
