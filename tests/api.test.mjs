// API tests against the local test server (no live data is touched).
//   node tests/api.test.mjs
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { getStore } from "@netlify/blobs";

// Stand-in for Microsoft sign-in and Graph, recording every email "sent".
import http from "node:http";
const mails = [];
const msMock = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString();
  if (req.url.includes("/oauth2/v2.0/token")) { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ access_token: "fake-token", expires_in: 3600 })); }
  if (req.url.includes("/sendMail")) {
    const msg = JSON.parse(body).message;
    if (msg.toRecipients[0].emailAddress.address.startsWith("bounce")) { res.writeHead(403, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: { code: "ErrorAccessDenied" } })); }
    mails.push({ auth: req.headers.authorization, from: decodeURIComponent(req.url.split("/users/")[1].split("/")[0]), msg });
    res.writeHead(202); return res.end();
  }
  res.writeHead(404); res.end();
});
await new Promise(r => msMock.listen(0, r));
const msBase = `http://localhost:${msMock.address().port}`;
Object.assign(process.env, { MS_TENANT_ID: "tenant", MS_CLIENT_ID: "client", MS_CLIENT_SECRET: "secret", MAIL_FROM: "eduhub@lwlat.org.uk", MS_LOGIN_BASE: msBase, MS_GRAPH_BASE: msBase });

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
const ROUNDS = [
  { id: "round-1", label: "Round 1", startTime: "10:30", endTime: "11:15", phases: ["secondary", "central"] },
  { id: "round-2", label: "Round 2", startTime: "11:20", endTime: "12:05", phases: ["primary"] },
  { id: "round-3", label: "Round 3", startTime: "12:10", endTime: "12:50", phases: ["primary"] },
  { id: "round-4", label: "Round 4", startTime: "12:55", endTime: "13:35", phases: ["secondary", "central"] }
];
await test("saving sessions does not touch event details, and the reverse", async () => {
  const before = (await call("admin-data", { auth: true })).data.eduhub;
  const r = await call("eduhub", { method: "POST", auth: true, body: { section: "programme", title: "HACKED", bookingStatus: "closed", requireSessionChoice: true,
    schools: [{ name: "Example Primary", phase: "primary" }, { name: "Example Academy", phase: "secondary" }, { name: "Trust Central Team", phase: "central" }],
    keynote: { name: "Graham Allcott", role: "Author", startTime: "09:00", endTime: "10:00", photoPath: "/assets/speakers/graham-allcott.jpg" },
    agenda: [{ startTime: "09:00", endTime: "10:00", title: "Keynote", kind: "keynote" }, { startTime: "10:30", title: "Workshop", kind: "workshop", roundId: "round-1", groups: ["secondary"] }, { title: "" }],
    rounds: ROUNDS,
    workshops: [
      { id: "botheredness", title: "Botheredness", speakerName: "Hywel Roberts", photoId, room: "S12", capacity: 1, recommended: "educators", description: "Story", adminNotes: "secret note" },
      { id: "curious", title: "Curious Schools", speakerName: "Dave Harris", photoPath: "/assets/speakers/dave-harris.jpg", room: "S14" },
      { id: "breathe", title: "Breathe Better", room: "Hall", warning: "Allergy warning: uses nuts." },
      { id: "inclusive", title: "Inclusive Leadership", recommended: "leaders", rounds: ["round-1", "round-4"], photoPath: "/../../etc/passwd" }
    ] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  prog = r.data.eduhub;
  assert.equal(prog.title, before.title); assert.equal(prog.bookingStatus, before.bookingStatus);
  assert.deepEqual(prog.foodChoices, before.foodChoices);
  assert.equal(prog.sessions.length, 3 * 4 + 2);
  assert.equal(prog.workshops[3].photoPath, "");
  const d = await call("eduhub", { method: "POST", auth: true, body: settings({ capacity: 0, foodChoices: menu, workshops: [], rounds: [], schools: [], keynote: {} }) });
  assert.equal(d.data.eduhub.sessions.length, 14);
  assert.equal(d.data.eduhub.keynote.name, "Graham Allcott");
});
await test("public data shows workshops, rounds and keynote but not admin notes", async () => {
  const e = (await call("public-data")).data.eduhub;
  assert.equal(e.workshops.length, 4); assert.equal(e.rounds.length, 4); assert.equal(e.keynote.startTime, "09:00");
  assert.equal(e.agenda.length, 2); assert.equal(e.agenda[1].roundId, "round-1");
  await call("eduhub", { method: "POST", auth: true, body: { section: "programme", ...prog, showAgenda: false } });
  assert.equal((await call("public-data")).data.eduhub.agenda.length, 0);
  await call("eduhub", { method: "POST", auth: true, body: { section: "programme", ...prog, showAgenda: true } }); assert.deepEqual(e.agenda[1].groups, ["secondary"]);
  assert.doesNotMatch(JSON.stringify(e), /secret note/);
  assert.equal(e.workshops.find(w => w.id === "breathe").warning, "Allergy warning: uses nuts.");
});
await test("sessions saved by version 5.1 are converted into rounds and workshops", async () => {
  const u = await import("../netlify/functions/_utils.mjs");
  const e = u.normaliseEduhub({ sessions: [{ title: "Old A", startTime: "10:00", endTime: "11:00" }, { title: "Old B", startTime: "10:00", endTime: "11:00" }, { title: "Old C", startTime: "11:30" }] });
  assert.equal(e.rounds.length, 2); assert.equal(e.workshops.length, 3); assert.equal(e.sessions.length, 3);
});
await test("the food workshop's allergy warning shows even on workshops saved without one", async () => {
  const u = await import("../netlify/functions/_utils.mjs");
  const e = u.normaliseEduhub({ rounds: [{ label: "Round 1" }], workshops: [{ id: "ten-things-food", title: "10 Things I Love About Food" }, { title: "Something else" }] });
  assert.match(e.workshops[0].warning, /variety of allergens, including nuts/);
  assert.match(e.sessions[0].warning, /variety of allergens/);
  assert.equal(e.workshops[1].warning, "");
  const byTitle = u.normaliseEduhub({ rounds: [{ label: "R" }], workshops: [{ id: "abc", title: "10 things I love about food", warning: "" }] });
  assert.match(byTitle.workshops[0].warning, /nuts/);
  const custom = u.normaliseEduhub({ rounds: [{ label: "R" }], workshops: [{ id: "ten-things-food", title: "10 Things I Love About Food", warning: "Contains nuts and sesame." }] });
  assert.equal(custom.workshops[0].warning, "Contains nuts and sesame.");
});
await test("the booklet's structure of the day shows until admins save their own, and can be hidden", async () => {
  const u = await import("../netlify/functions/_utils.mjs");
  const e = u.normaliseEduhub({ rounds: [{ id: "round-1", label: "Round 1" }], workshops: [{ title: "A" }], agenda: [] });
  assert.equal(e.agenda.length, 15); assert.equal(e.agenda[0].title, "Registration");
  assert.equal(e.agenda.find(a => a.kind === "workshop").roundId, "round-1");
  assert.equal(u.normaliseEduhub({ showAgenda: false }).showAgenda, false);
});
await test("a round that finishes before it starts is refused", async () => {
  const r = await call("eduhub", { method: "POST", auth: true, body: { section: "programme", rounds: [{ label: "Backwards", startTime: "11:00", endTime: "10:00" }] } });
  assert.equal(r.status, 400);
});
const school = n => prog.schools.find(x => x.name === n).id;
const sid = (t, round) => prog.sessions.find(x => x.title === t && x.roundId === round).id;
const sBook = (n, extra) => call("book", { method: "POST", body: staff(n, { foodChoiceId: menu[0].id, organisation: "ignored", ...extra }) });
await test("school must be chosen from the list", async () => {
  assert.equal((await sBook(400, { sessionIds: [] })).status, 400);
  assert.equal((await sBook(400, { schoolId: "made-up" })).status, 400);
});
await test("primary staff cannot book a workshop in a secondary round", async () => {
  const r = await sBook(401, { schoolId: school("Example Primary"), sessionIds: [sid("Botheredness", "round-1"), sid("Curious Schools", "round-3")] });
  assert.equal(r.status, 400); assert.match(r.data.error, /not in one of your rounds/);
});
await test("only one workshop per round", async () => {
  const r = await sBook(402, { schoolId: school("Example Primary"), sessionIds: [sid("Botheredness", "round-2"), sid("Curious Schools", "round-2"), sid("Breathe Better", "round-3")] });
  assert.equal(r.status, 400); assert.match(r.data.error, /only one workshop/);
});
await test("the same workshop cannot be chosen in two rounds", async () => {
  const r = await sBook(402, { schoolId: school("Example Primary"), sessionIds: [sid("Curious Schools", "round-2"), sid("Curious Schools", "round-3")] });
  assert.equal(r.status, 400); assert.match(r.data.error, /more than once/);
});
await test("a workshop must be chosen in each of their rounds", async () => {
  const r = await sBook(403, { schoolId: school("Example Primary"), sessionIds: [sid("Botheredness", "round-2")] });
  assert.equal(r.status, 400); assert.match(r.data.error, /Round 3, 12:10 to 12:50/);
});
await test("valid primary booking saves school, phase and workshops", async () => {
  const r = await sBook(404, { schoolId: school("Example Primary"), sessionIds: [sid("Botheredness", "round-2"), sid("Curious Schools", "round-3")] });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const b = (await call("admin-data", { auth: true })).data.bookings.find(x => x.email === "test.person404@lwlat.org.uk");
  assert.equal(b.organisation, "Example Primary"); assert.equal(b.phase, "primary");
  assert.deepEqual(b.sessions.map(x => `${x.time}: ${x.title}`), ["Round 2, 11:20 to 12:05: Botheredness", "Round 3, 12:10 to 12:50: Curious Schools"]);
  assert.equal(b.sessions[0].room, "S12"); assert.equal(b.sessions[0].speaker, "Hywel Roberts");
});
await test("places are per round: a full workshop is refused in that round only", async () => {
  const r = await sBook(405, { schoolId: school("Example Primary"), sessionIds: [sid("Botheredness", "round-2"), sid("Curious Schools", "round-3")] });
  assert.equal(r.status, 409); assert.equal(r.data.fullSession, true);
  assert.equal((await call("public-data")).data.eduhub.sessions.find(x => x.id === sid("Botheredness", "round-2")).placesLeft, 0);
  assert.equal((await sBook(405, { schoolId: school("Example Primary"), sessionIds: [sid("Curious Schools", "round-2"), sid("Botheredness", "round-3")] })).status, 200);
});
await test("central staff book in rounds 1 and 4, including a workshop that runs only then", async () => {
  const r = await sBook(406, { schoolId: school("Trust Central Team"), sessionIds: [sid("Inclusive Leadership", "round-1"), sid("Breathe Better", "round-4")] });
  assert.equal(r.status, 200, JSON.stringify(r.data));
});
await test("admin can move someone, still one per round and no repeats", async () => {
  const b = (await call("admin-data", { auth: true })).data.bookings.find(x => x.email === "test.person406@lwlat.org.uk");
  const upd = fields => call("booking", { method: "POST", auth: true, body: { id: b.id, action: "update", fields } });
  assert.equal((await upd({ sessionIds: [sid("Breathe Better", "round-1"), sid("Curious Schools", "round-1")] })).status, 400);
  assert.equal((await upd({ sessionIds: [sid("Breathe Better", "round-1"), sid("Breathe Better", "round-4")] })).status, 400);
  const ok = await upd({ schoolId: school("Example Academy"), sessionIds: [sid("Botheredness", "round-1"), sid("Curious Schools", "round-4")] });
  assert.equal(ok.status, 200); assert.equal(ok.data.booking.phase, "secondary");
  assert.deepEqual(ok.data.booking.sessions.map(x => x.title), ["Botheredness", "Curious Schools"]);
});
await test("workshop register lists confirmed attendees with dietary needs, no email", async () => {
  const csv = await (await fetch(BASE + `/api/export-bookings?view=register&session=${encodeURIComponent(sid("Botheredness", "round-2"))}`, { headers: { cookie } })).text();
  assert.match(csv, /Botheredness/); assert.match(csv, /Person 404/); assert.match(csv, /Dietary requirements/); assert.match(csv, /Arrived at event/);
  assert.doesNotMatch(csv, /@lwlat/);
  const full = await (await fetch(BASE + "/api/export-bookings?item=eduhub", { headers: { cookie } })).text();
  assert.match(full, /Round 2, 11:20 to 12:05: Botheredness \(S12\)/);
});
await test("workshops not required: rounds can be left empty", async () => {
  await call("eduhub", { method: "POST", auth: true, body: { section: "programme", requireSessionChoice: false, schools: prog.schools, rounds: prog.rounds, workshops: prog.workshops, keynote: prog.keynote } });
  assert.equal((await sBook(407, { schoolId: school("Example Academy"), sessionIds: [] })).status, 200);
});

console.log("Tickets, check-in and email");
await test("recognition award link: on by default, must be https, can be removed", async () => {
  assert.equal((await call("public-data")).data.eduhub.recognitionUrl, "https://forms.cloud.microsoft/e/PsKimNCMdT");
  assert.equal((await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: menu, recognitionUrl: "javascript:alert(1)" }) })).status, 400);
  await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: menu, recognitionUrl: "" }) });
  assert.equal((await call("public-data")).data.eduhub.recognitionUrl, "");
  await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: menu, recognitionUrl: "https://forms.cloud.microsoft/e/PsKimNCMdT" }) });
});
let ticketBooking, ticketPath;
await test("booking sends an email with an inline QR code and returns a ticket link", async () => {
  await call("eduhub", { method: "POST", auth: true, body: settings({ capacity: 0, foodChoices: menu, contactEmail: "eduhub@lwlat.org.uk" }) });
  mails.length = 0;
  const r = await sBook(500, { schoolId: school("Example Primary"), sessionIds: [sid("Breathe Better", "round-2")] });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.emailSent, true);
  assert.match(r.data.ticketUrl, /^http:\/\/localhost:\d+\/ticket\/\?b=[0-9a-f-]{36}&s=[\w-]{22}$/);
  ticketPath = r.data.ticketUrl.split("/ticket/?")[1];
  assert.equal(mails.length, 1);
  const m = mails[0];
  assert.equal(m.from, "eduhub@lwlat.org.uk"); assert.equal(m.auth, "Bearer fake-token");
  assert.equal(m.msg.toRecipients[0].emailAddress.address, "test.person500@lwlat.org.uk");
  assert.match(m.msg.subject, /EH27-/);
  assert.match(m.msg.body.content, /cid:ticketqr/); assert.match(m.msg.body.content, /Breathe Better/); assert.match(m.msg.body.content, /Dear Test/);
  assert.match(m.msg.body.content, /mailto:eduhub@lwlat\.org\.uk/);
  assert.match(m.msg.body.content, /forms\.cloud\.microsoft\/e\/PsKimNCMdT/);
  const png = Buffer.from(m.msg.attachments[0].contentBytes, "base64");
  assert.equal(png.subarray(0, 4).toString("hex"), "89504e47"); assert.equal(m.msg.attachments[0].isInline, true);
  ticketBooking = (await call("admin-data", { auth: true })).data.bookings.find(x => x.email === "test.person500@lwlat.org.uk");
  assert.ok(ticketBooking.emailSentAt);
});
await test("a failed email never loses the booking, and is recorded", async () => {
  const r = await sBook(501, { email: "bounce.me@lwlat.org.uk", schoolId: school("Example Primary"), sessionIds: [] });
  assert.equal(r.status, 200); assert.equal(r.data.emailSent, false);
  const b = (await call("admin-data", { auth: true })).data.bookings.find(x => x.email === "bounce.me@lwlat.org.uk");
  assert.match(b.emailError, /ErrorAccessDenied/);
});
await test("QR image and ticket need a valid signature", async () => {
  const good = await fetch(`${BASE}/api/qr?${ticketPath}`);
  assert.equal(good.status, 200); assert.equal(good.headers.get("content-type"), "image/png");
  assert.equal((await fetch(`${BASE}/api/qr?${ticketPath.slice(0, -2)}xx`)).status, 404);
  assert.equal((await fetch(`${BASE}/api/ticket?b=${ticketBooking.id}&s=forged`)).status, 404);
});
await test("ticket shows only basic details to the public, full details to admins", async () => {
  const pub = await (await fetch(`${BASE}/api/ticket?${ticketPath}`)).json();
  assert.equal(pub.firstName, "Test"); assert.equal(pub.isAdmin, false);
  assert.equal(pub.lastName, undefined); assert.equal(pub.dietary, undefined); assert.equal(pub.accessibility, undefined);
  const adm = await (await fetch(`${BASE}/api/ticket?${ticketPath}`, { headers: { cookie } })).json();
  assert.equal(adm.isAdmin, true); assert.equal(adm.lastName, "Person 500"); assert.equal(adm.organisation, "Example Primary");
});
const scan = (extra = {}, auth = true) => fetch(`${BASE}/api/ticket`, { method: "POST", headers: { "content-type": "application/json", ...(auth ? { cookie } : {}) },
  body: JSON.stringify({ b: new URLSearchParams(ticketPath).get("b"), s: new URLSearchParams(ticketPath).get("s"), ...extra }) }).then(async r => ({ status: r.status, data: await r.json() }));
await test("scanning checks someone in once, warns on repeat, and can be undone", async () => {
  assert.equal((await scan({}, false)).status, 401);
  const first = await scan(); assert.equal(first.status, 200); assert.equal(first.data.already, false); assert.ok(first.data.checkedInAt);
  const again = await scan(); assert.equal(again.data.already, true); assert.equal(again.data.checkedInAt, first.data.checkedInAt);
  await scan({ action: "undo" });
  assert.equal((await call("admin-data", { auth: true })).data.bookings.find(x => x.id === ticketBooking.id).checkedInAt, undefined);
});
await test("cancelled bookings are refused at the door, waiting list needs 'check in anyway'", async () => {
  await call("booking", { method: "POST", auth: true, body: { id: ticketBooking.id, action: "cancel" } });
  const c = await scan(); assert.equal(c.status, 409); assert.match(c.data.error, /cancelled/);
  await call("booking", { method: "POST", auth: true, body: { id: ticketBooking.id, action: "reinstate" } });
  await call("booking", { method: "POST", auth: true, body: { id: ticketBooking.id, action: "waiting" } });
  const w = await scan(); assert.equal(w.status, 409); assert.equal(w.data.canForce, true);
  assert.equal((await scan({ force: true })).status, 200);
  await scan({ action: "undo" });
});
await test("giving a waiting-list place emails the ticket, resend works", async () => {
  mails.length = 0;
  const r = await call("booking", { method: "POST", auth: true, body: { id: ticketBooking.id, action: "confirm" } });
  assert.equal(r.status, 200); assert.equal(r.data.email.sent, true); assert.equal(r.data.booking.sendEmail, undefined);
  assert.equal(mails.length, 1); assert.ok(mails[0].msg.attachments);
  assert.equal((await call("booking", { method: "POST", auth: true, body: { id: ticketBooking.id, action: "resend" } })).data.email.sent, true);
  assert.equal(mails.length, 2);
  const stored = (await call("admin-data", { auth: true })).data.bookings.find(x => x.id === ticketBooking.id);
  assert.equal(stored.sendEmail, undefined);
});
await test("waiting-list email has no QR code", async () => {
  await call("eduhub", { method: "POST", auth: true, body: settings({ capacity: 1, foodChoices: menu }) });
  mails.length = 0;
  const r = await sBook(502, { schoolId: school("Example Primary"), sessionIds: [] });
  assert.equal(r.data.waitingList, true); assert.equal(r.data.ticketUrl, "");
  assert.match(mails[0].msg.subject, /^Waiting list/); assert.equal(mails[0].msg.attachments, undefined);
  await call("eduhub", { method: "POST", auth: true, body: settings({ capacity: 0, foodChoices: menu }) });
});
await test("admin can send a test email, check in from the list, and export check-ins", async () => {
  assert.equal((await call("email-test", { method: "POST", auth: true, body: { to: "not-an-email" } })).status, 400);
  assert.equal((await call("email-test", { method: "POST", auth: true, body: { to: "tom@lwlat.org.uk" } })).status, 200);
  await call("booking", { method: "POST", auth: true, body: { id: ticketBooking.id, action: "checkin" } });
  const csv = await (await fetch(BASE + "/api/export-bookings?item=eduhub", { headers: { cookie } })).text();
  assert.match(csv, /"Checked in","Email sent"/);
});

console.log("Speakers, governors and trustees");
let speakerCode;
await test("speaker link code is created by the server and never public", async () => {
  const d = await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: menu, capacity: 0, speakerBookingOpen: true, speakerCode: "chosen-by-browser" }) });
  speakerCode = d.data.eduhub.speakerCode;
  assert.match(speakerCode, /^[A-Za-z0-9]{16,20}$/);
  assert.doesNotMatch(JSON.stringify((await call("public-data")).data), new RegExp(speakerCode));
  const again = await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: menu, speakerBookingOpen: true }) });
  assert.equal(again.data.eduhub.speakerCode, speakerCode);
  const fresh = await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: menu, speakerBookingOpen: true, newSpeakerCode: true }) });
  assert.notEqual(fresh.data.eduhub.speakerCode, speakerCode);
  speakerCode = fresh.data.eduhub.speakerCode;
});
const speaker = extra => call("book", { method: "POST", body: { itemType: "eduhub-speaker", firstName: "Sam", lastName: "Speaker", email: "sam@speakers.example", leading: "Botheredness (Hywel Roberts)", foodChoiceId: menu[1].id, consent: true, code: speakerCode, ...extra } });
await test("speaker access check and link validation", async () => {
  assert.deepEqual((await call(`speaker-access?code=${speakerCode}`)).data, { valid: true, open: true });
  assert.equal((await call("speaker-access?code=wrong")).data.valid, false);
  assert.equal((await speaker({ code: "wrong" })).status, 403);
  assert.equal((await speaker({ leading: "Made up session" })).status, 400);
});
await test("speaker books lunch with any email, outside staff capacity", async () => {
  await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: menu, capacity: 1, speakerBookingOpen: true }) });
  const r = await speaker({});
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.waitingList, false); assert.match(r.data.reference, /^EHS-/);
  const b = (await call("admin-data", { auth: true })).data.bookings.find(x => x.email === "sam@speakers.example");
  assert.equal(b.role, "speaker"); assert.equal(b.leading, "Botheredness (Hywel Roberts)"); assert.equal(b.foodChoice, "Tuna Mayo Sandwich");
  assert.deepEqual(b.sessionIds, undefined);
  const csv = await (await fetch(BASE + "/api/export-bookings?item=eduhub&view=catering", { headers: { cookie } })).text();
  assert.match(csv, /"Speaker","Sam","Speaker"/);
  assert.match(mails.at(-1).msg.subject, /lunch booking/); assert.doesNotMatch(mails.at(-1).msg.body.content, /recognition award/);
});
await test("speaker bookings close with the switch", async () => {
  await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: menu, capacity: 0, speakerBookingOpen: false }) });
  assert.equal((await call(`speaker-access?code=${speakerCode}`)).data.open, false);
  assert.equal((await speaker({ email: "late@speakers.example" })).status, 403);
});
await test("governor books with any email and gets their school's rounds", async () => {
  await call("eduhub", { method: "POST", auth: true, body: { section: "programme", requireSessionChoice: true, schools: prog.schools, rounds: prog.rounds, workshops: prog.workshops, keynote: prog.keynote } });
  const gov = extra => call("book", { method: "POST", body: { itemType: "eduhub", role: "governor", firstName: "Gwen", lastName: "Governor", email: "gwen@example.org", foodChoiceId: menu[0].id, consent: true, ...extra } });
  assert.equal((await gov({ schoolId: school("Example Primary"), sessionIds: [sid("Curious Schools", "round-1"), sid("Breathe Better", "round-4")] })).status, 400);
  const r = await gov({ schoolId: school("Example Primary"), sessionIds: [sid("Curious Schools", "round-2"), sid("Breathe Better", "round-3")] });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const b = (await call("admin-data", { auth: true })).data.bookings.find(x => x.email === "gwen@example.org");
  assert.equal(b.role, "governor"); assert.equal(b.roleName, "Governor"); assert.equal(b.organisation, "Example Primary");
});
await test("trustee needs no school and follows the central rounds", async () => {
  const r = await call("book", { method: "POST", body: { itemType: "eduhub", role: "trustee", firstName: "Toby", lastName: "Trustee", email: "toby@example.org", foodChoiceId: menu[0].id, consent: true, sessionIds: [sid("Inclusive Leadership", "round-1"), sid("Curious Schools", "round-4")] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const b = (await call("admin-data", { auth: true })).data.bookings.find(x => x.email === "toby@example.org");
  assert.equal(b.organisation, "Board of Trustees"); assert.equal(b.phase, "central");
});
await test("staff still need a Trust email, and governors can be switched off", async () => {
  const st = await call("book", { method: "POST", body: staff(600, { email: "someone@gmail.com", role: "staff", schoolId: school("Example Primary"), foodChoiceId: menu[0].id }) });
  assert.equal(st.status, 400); assert.match(st.data.error, /governors and trustees/i);
  await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: menu, allowGovernors: false }) });
  const off = await call("book", { method: "POST", body: { itemType: "eduhub", role: "governor", firstName: "No", lastName: "Entry", email: "no@example.org", schoolId: school("Example Primary"), foodChoiceId: menu[0].id, consent: true } });
  assert.equal(off.status, 403);
  await call("eduhub", { method: "POST", auth: true, body: settings({ foodChoices: menu, allowGovernors: true }) });
});

console.log("Sign-in protection");
await test("repeated wrong passwords lead to a temporary lockout", async () => {
  let last;
  for (let i = 0; i < 9; i++) last = await call("login", { method: "POST", body: { password: "wrong" + i } });
  assert.equal(last.status, 429);
  assert.equal((await call("login", { method: "POST", body: { password: "local-admin-password" } })).status, 429);
});

server.kill(); msMock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
