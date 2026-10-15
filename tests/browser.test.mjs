// End-to-end browser test of the public and admin journeys, using Playwright.
//   node tests/browser.test.mjs [screenshot-folder]
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require("/opt/node22/lib/node_modules/playwright"); }

const shots = process.argv[2] || "";
if (shots) fs.mkdirSync(shots, { recursive: true });
const PORT = 9050 + Math.floor(Math.random() * 40) * 2;
const BASE = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ["tests/dev-server.mjs", String(PORT)], { stdio: ["ignore", "pipe", "inherit"] });
await new Promise(r => server.stdout.on("data", d => String(d).includes("test server") && r()));

const browser = await playwright.chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? undefined : undefined });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => m.type() === "error" && !m.text().includes("fonts.g") && errors.push(m.text()));
process.on("exit", () => errors.length && console.log("  browser console:", [...new Set(errors)].join(" | ")));
page.on("dialog", d => d.accept());
// Picks the school and the first open workshop in every round.
async function fillStaff(p, first, last, email, school){
  await p.fill("#firstName", first); await p.fill("#lastName", last); await p.fill("#email", email);
  await p.selectOption("#schoolId", { label: school });
  await p.waitForSelector(".session-slot");
  for (const slot of await p.locator(".session-slot").all()) await slot.locator("input:not([disabled])").first().check();
}
const PNG_FILE = "/tmp/lwlat-test-speaker.png";
fs.writeFileSync(PNG_FILE, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const snap = async (name, p = page) => shots && p.screenshot({ path: `${shots}/${name}.png`, fullPage: true });

let passed = 0, failed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log("  ✓ " + name); }
  catch (err) { failed++; console.log("  ✗ " + name + "\n    " + String(err.message).split("\n").slice(0, 4).join("\n    ")); await snap("FAILED-" + name.replace(/\W+/g, "-")); }
}

await step("homepage shows EduHub as Bookings Open Soon with a popup", async () => {
  await page.goto(BASE + "/");
  await page.waitForSelector("#eduhub-summary span");
  assert.equal((await page.textContent("#eduhub-book")).trim(), "Bookings Open Soon");
  await page.click("#eduhub-book");
  assert.ok(await page.isVisible("#eduhub-modal.open"));
  await snap("01-home-coming-soon");
  await page.keyboard.press("Escape");
  assert.ok(!(await page.isVisible("#eduhub-modal.open")));
});

await step("EduHub page hides the form while bookings are coming soon", async () => {
  await page.goto(BASE + "/eduhub/");
  await page.waitForFunction(() => document.querySelector("#status-heading").textContent === "Bookings open soon");
  assert.ok(await page.isHidden("#booking-area"));
  assert.ok(await page.isVisible("#booking-closed"));
});

await step("old preview link redirects to the EduHub preview", async () => {
  await page.goto(BASE + "/eduhub-preview.html");
  assert.match(page.url(), /\/eduhub\/\?preview=1$/);
  assert.ok(await page.isVisible("#preview-banner"));
  assert.ok(await page.isVisible("#eduhub-form"));
});

await step("admin signs in and fills the menu in from the allergen matrix", async () => {
  await page.goto(BASE + "/admin/");
  await page.fill("#password", "local-admin-password");
  await page.click("#login-form button");
  await page.waitForSelector("#admin-view:not(.hidden)");
  await page.click("[data-view=eduhub]");
  await page.click("#load-matrix-menu");
  assert.equal(await page.locator(".food-row").count(), 10);
  assert.match(await page.textContent(".food-row:nth-child(3) .food-row-summary"), /Gluten \(wheat\), Tree nuts \(almond, cashew\)/);
  // Mark every option as checked with the caterer.
  for (const box of await page.locator("[data-f-confirmed]").all()) await box.check();
  await page.fill("#eh-time", "08:30 to 15:30");
  await page.fill("#eh-capacity", "2");
  await page.fill("#eh-contact", "eduhub@lwlat.org.uk");
  await snap("02-admin-eduhub-menu");
});

await step("admin preview shows the menu with allergens and never submits", async () => {
  await page.click("#eduhub-form button[type=submit]"); // save first, still coming soon
  await page.waitForSelector("#admin-message .notice");
  const preview = await context.newPage();
  preview.on("pageerror", e => errors.push(e.message));
  await preview.goto(BASE + "/eduhub/?preview=1");
  await preview.waitForSelector(".food-option");
  assert.equal(await preview.locator(".food-option").count(), 10);
  // Allergen matrix link sits directly beneath the food options.
  const next = await preview.evaluate(() => document.querySelector("#food-options").nextElementSibling.querySelector("a").getAttribute("href"));
  assert.equal(next, "/documents/EduHub-2027-Allergen-Matrix.pdf");
  await preview.fill("#firstName", "Preview"); await preview.fill("#lastName", "Person");
  await preview.fill("#email", "preview.person@lwlat.org.uk"); await preview.fill("#organisation", "Test Academy");
  await preview.check(".food-option >> nth=0"); await preview.check("#consent");
  let posted = false; preview.on("request", r => r.url().includes("/api/book") && (posted = true));
  await preview.click("#submit-button");
  await preview.waitForSelector("#form-message .notice.warn");
  assert.equal(posted, false);
  await snap("03-eduhub-preview", preview);
  await preview.close();
});

await step("admin fills in the workshop booklet, adds schools, and saves", async () => {
  await page.click("[data-view=programme]");
  await page.click("#load-booklet");
  assert.equal(await page.locator(".workshop-row").count(), 12);
  assert.equal(await page.locator(".round-row").count(), 4);
  assert.equal(await page.inputValue("#k-name"), "Graham Allcott");
  assert.equal(await page.locator(".round-row").first().locator("[data-r=startTime]").inputValue(), "10:30");
  // Bundled speaker photos load.
  await page.waitForFunction(() => [...document.querySelectorAll(".workshop-row .speaker-photo img")].every(i => i.complete && i.naturalWidth > 50));
  const first = page.locator(".workshop-row").first();
  await first.locator("[data-w=room]").fill("Room P1");
  await first.locator("[data-w=capacity]").fill("1");
  // Replacing a photo uploads it.
  await page.locator(".workshop-row").nth(1).locator("[data-photo-file]").setInputFiles(PNG_FILE);
  await page.locator(".workshop-row").nth(1).locator("[data-photo-status]", { hasText: "Photo uploaded" }).waitFor();
  await page.click(".bulk-add summary");
  await page.fill("#bulk-schools", "Example Primary School\nAnother Primary School");
  await page.click("#bulk-add-schools");
  await page.click("#add-school");
  await page.locator(".school-row:not(.round-row)").last().locator("[data-school-name]").fill("Example Secondary Academy");
  await page.locator(".school-row:not(.round-row)").last().locator("[data-school-phase]").selectOption("secondary");
  await page.click("#add-school");
  await page.locator(".school-row:not(.round-row)").last().locator("[data-school-name]").fill("Central Trust Team");
  await page.locator(".school-row:not(.round-row)").last().locator("[data-school-phase]").selectOption("central");
  await page.click("#programme-form button[type=submit]");
  await page.waitForFunction(() => document.querySelector("#admin-message").textContent.includes("Sessions saved"));
  assert.equal(await page.locator(".workshop-row").count(), 12);
  assert.equal(await page.locator("#school-builder .school-row").count(), 4);
  assert.match(await page.textContent("#session-summary"), /Round 2, 11:20 to 12:05 \(Primary\)/);
  await snap("02b-admin-sessions");
  await page.click("[data-view=eduhub]");
});

await step("admin opens bookings", async () => {
  await page.check("input[name=bookingStatus][value=open]");
  await page.click("#eduhub-form button[type=submit]");
  await page.waitForFunction(() => document.querySelector("#eduhub-live-status").textContent.includes("Open."));
});

const staffPage = await context.newPage();
staffPage.on("pageerror", e => errors.push(e.message));
await step("homepage now links straight to booking", async () => {
  await staffPage.goto(BASE + "/");
  await staffPage.waitForFunction(() => document.querySelector("#eduhub-book").dataset.status === "open");
  assert.equal((await staffPage.textContent("#eduhub-book")).trim(), "Book your place");
  await staffPage.click("#eduhub-book");
  await staffPage.waitForURL(/\/eduhub\/#booking$/);
});

await step("EduHub page shows the day, workshop tiles and a lightbox with details", async () => {
  await staffPage.waitForSelector(".workshop-tile");
  assert.equal(await staffPage.locator(".workshop-tile").count(), 12);
  // Tiles show only photo, title, speaker and recommended audience.
  const tile = staffPage.locator(".workshop-tile").first();
  assert.doesNotMatch(await tile.textContent(), /Kindness matters/);
  // Timeline with group tabs: primaries have People Strategy at 10:30, secondaries a workshop.
  assert.match(await staffPage.textContent("#day-timeline"), /People Strategy launch/);
  await staffPage.click('#day-tabs [data-phase="secondary"]');
  assert.match(await staffPage.locator("#day-timeline .timeline-item").nth(4).textContent(), /Workshop: Round 1/);
  await snap("04a-eduhub-day-and-tiles", staffPage);
  await tile.click();
  await staffPage.waitForSelector("#workshop-dialog[open]");
  assert.match(await staffPage.textContent("#workshop-dialog"), /Kindness matters/);
  assert.match(await staffPage.textContent("#workshop-dialog"), /Round 2, 11:20 to 12:05/);
  await snap("04b-eduhub-lightbox", staffPage);
  await staffPage.keyboard.press("Escape");
  assert.equal(await staffPage.locator("#workshop-dialog[open]").count(), 0);
  // The food workshop carries its nut warning on the tile and in the lightbox.
  const food = staffPage.locator(".workshop-tile", { hasText: "10 Things I Love About Food" });
  assert.match(await food.textContent(), /Allergy warning/);
  await food.click();
  assert.match(await staffPage.textContent("#workshop-dialog .warning-notice"), /use of nuts/);
  await staffPage.click("#dialog-close");
});

await step("form explains every problem before sending", async () => {
  await staffPage.waitForSelector(".food-option");
  await staffPage.fill("#email", "someone@gmail.com");
  await staffPage.click("#submit-button");
  const msg = await staffPage.textContent("#form-message");
  for (const t of ["first name", "surname", "school or team", "@lwlat.org.uk", "food option", "confirm"]) assert.ok(msg.includes(t), `missing "${t}" in: ${msg}`);
  assert.equal(await staffPage.getAttribute("#email", "aria-invalid"), "true");
  await snap("04-eduhub-validation", staffPage);
});

await step("member of staff books a place with a food choice", async () => {
  await fillStaff(staffPage, "Alex", "Taylor", "Alex.Taylor@lwlat.org.uk", "Example Primary School");
  // Primary staff are offered rounds 2 and 3 only, and cannot repeat a workshop.
  const offered = await staffPage.textContent("#session-options");
  assert.match(offered, /Round 2/); assert.match(offered, /Round 3/); assert.doesNotMatch(offered, /Round 1|Round 4/);
  assert.equal(await staffPage.locator(".session-slot").nth(1).locator(".session-option.is-taken").count(), 1);
  assert.match(await staffPage.textContent("#programme"), /Graham Allcott/);
  // "Your day" beside the form follows their school and fills in chosen workshops.
  assert.match(await staffPage.textContent("#your-day"), /Botheredness/);
  assert.doesNotMatch(await staffPage.textContent("#your-day"), /Round 1/);
  await snap("05a-eduhub-sessions", staffPage);
  await staffPage.locator(".food-option", { hasText: "Tuna Mayo Sandwich" }).locator("input").check();
  await staffPage.fill("#dietary", "Mild lactose intolerance");
  await staffPage.check("#consent");
  await staffPage.click("#submit-button");
  await staffPage.waitForSelector(".confirmation");
  const text = await staffPage.textContent(".confirmation");
  assert.match(text, /EH27-[A-Z2-9]{6}/);
  assert.match(text, /Tuna Mayo Sandwich/);
  assert.match(text, /Round 2, 11:20 to 12:05: Botheredness.*, Room P1/);
  assert.equal(await staffPage.getAttribute(".recognition-box a", "href"), "https://forms.cloud.microsoft/e/PsKimNCMdT");
  assert.ok(await staffPage.isVisible("a[download='EduHub-2027.ics']"));
  await snap("05-eduhub-confirmation", staffPage);
});

await step("confirmation shows a QR ticket; the ticket page works for staff and door staff", async () => {
  const qr = staffPage.locator(".confirmation .ticket-qr");
  await qr.waitFor();
  await staffPage.waitForFunction(() => { const img = document.querySelector(".confirmation .ticket-qr"); return img && img.complete && img.naturalWidth > 100; }, null, { timeout: 15000 });
  const href = await staffPage.getAttribute(".confirmation a[href*='/ticket/']", "href");
  // A member of staff (not signed in) sees their ticket and QR code only.
  const outsider = await browser.newContext();
  const op = await outsider.newPage();
  await op.goto(href);
  await op.waitForSelector(".ticket-qr");
  assert.match(await op.textContent("#ticket"), /Your ticket/);
  assert.doesNotMatch(await op.textContent("#ticket"), /lactose|Taylor/);
  await snap("05b-ticket-public", op);
  await outsider.close();
  // Door staff, signed in to admin, scan the code and get a green screen.
  const door = await context.newPage();
  await door.goto(href);
  await door.waitForSelector(".scan-result.ok");
  assert.match(await door.textContent(".scan-result"), /Checked in: Alex Taylor/);
  await snap("05c-door-checked-in", door);
  await door.reload();
  await door.waitForSelector(".scan-result.warn");
  assert.match(await door.textContent(".scan-result"), /Already checked in/);
  await door.close();
});

await step("booking the same email again is refused", async () => {
  await staffPage.goto(BASE + "/eduhub/");
  await staffPage.waitForSelector(".food-option");
  await fillStaff(staffPage, "Alex", "Taylor", "alex.taylor@lwlat.org.uk", "Example Primary School");
  await staffPage.locator("#food-options .food-option").first().locator("input").check(); await staffPage.check("#consent");
  await staffPage.click("#submit-button");
  await staffPage.waitForSelector("#form-message .notice.error");
  assert.match(await staffPage.textContent("#form-message"), /already a booking/);
});

await step("second and third bookings fill the event, then the waiting list", async () => {
  for (const [n, first, school] of [[2, "Sam", "Another Primary School"], [3, "Jo", "Central Trust Team"]]) {
    await staffPage.goto(BASE + "/eduhub/");
    await staffPage.waitForSelector(".food-option");
    await fillStaff(staffPage, first, "Smith", `${first.toLowerCase()}.smith@lwlat.org.uk`, school);
    if (first === "Sam") assert.equal(await staffPage.locator(".session-option.is-full", { hasText: "Botheredness" }).count(), 1, "Botheredness should be full in round 2 only");
    await staffPage.locator("#food-options .food-option").nth(n).locator("input").check(); await staffPage.check("#consent");
    await staffPage.click("#submit-button");
    await staffPage.waitForSelector(".confirmation");
  }
  assert.match(await staffPage.textContent(".confirmation"), /waiting list/);
});

await step("admin sees food, allergens and catering totals", async () => {
  await page.reload();
  await page.waitForSelector("#admin-view:not(.hidden)");
  assert.equal((await page.textContent("#stat-eduhub-bookings")).trim(), "3");
  await page.click("[data-view=eduhub]");
  const summary = await page.textContent("#catering-summary");
  assert.match(summary, /Confirmed places\s*2/);
  assert.match(summary, /Mild lactose intolerance/);
  await snap("06-admin-catering");
  await page.click("[data-view=bookings]");
  const table = await page.textContent("#bookings-table");
  assert.match(table, /Tuna Mayo Sandwich/);
  assert.match(table, /Gluten \(wheat\), Eggs, Fish/);
  assert.match(table, /Waiting list/);
  assert.match(table, /Checked in \d\d:\d\d/);
  assert.match(await page.textContent("#overview-view"), /Not set up yet/);
  await snap("07-admin-bookings");
});

await step("admin gives the waiting-list person a place and edits a food choice", async () => {
  await page.click("[data-booking-action=confirm]");
  await page.waitForFunction(() => !document.querySelector("#bookings-table").textContent.includes("Waiting list"));
  await page.locator("tr", { hasText: "Alex" }).locator("[data-booking-edit]").click();
  await page.selectOption("#b-food", { label: "Egg and Cress Sandwich" });
  await page.fill("#b-admin-notes", "Changed by email");
  await page.click("#booking-edit-form button[type=submit]");
  await page.waitForFunction(() => document.querySelector("#bookings-table").textContent.includes("Egg and Cress Sandwich"));
});

await step("caterer's CSV downloads", async () => {
  await page.click("[data-view=eduhub]");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("a[href*='view=catering']")]);
  const csv = fs.readFileSync(await download.path(), "utf8");
  assert.match(csv, /Egg and Cress Sandwich/);
  assert.doesNotMatch(csv, /@lwlat/);
});

await step("Professional Learning: create, publish and book a course", async () => {
  await page.click("[data-view=courses]");
  await page.click("#add-course");
  await page.fill("#c-title", "Early Reading Network");
  await page.fill("#c-summary", "A termly network meeting for reading leads.");
  await page.fill("[data-session=date]", "2099-02-10");
  await page.selectOption("#c-status", "published");
  await page.check("#course-form [name=askDietary]");
  await page.click("#course-form button[type=submit]");
  await page.waitForFunction(() => document.querySelector("#courses-table").textContent.includes("Early Reading Network"));
  await staffPage.goto(BASE + "/");
  await staffPage.waitForSelector(".course-book");
  await staffPage.click(".course-book");
  await staffPage.fill("#firstName", "Pat"); await staffPage.fill("#lastName", "Jones");
  await staffPage.fill("#email", "pat@example.org"); await staffPage.fill("#organisation", "Partner School");
  await staffPage.click("#booking-form button[type=submit]");
  await staffPage.waitForSelector(".success-panel");
  assert.match(await staffPage.textContent(".success-panel"), /PL-[A-Z2-9]{6}/);
});

await step("mobile layout has no sideways scrolling", async () => {
  const mobile = await browser.newPage({ viewport: { width: 375, height: 800 } });
  for (const url of ["/", "/eduhub/", "/eduhub/?preview=1"]) {
    await mobile.goto(BASE + url);
    await mobile.waitForTimeout(400);
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `${url} overflows by ${overflow}px`);
  }
  await snap("08-mobile-eduhub-preview", mobile);
  await mobile.close();
});

await step("no JavaScript errors on any page", async () => {
  // Expected 401/400/409 replies (signed-out check, validation, duplicate) are logged by
  // the browser as "Failed to load resource". Anything else is a real script error.
  assert.deepEqual(errors.filter(e => !e.startsWith("Failed to load resource")), []);
});

await browser.close();
server.kill();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
