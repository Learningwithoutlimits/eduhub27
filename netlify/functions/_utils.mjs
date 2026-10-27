import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { ALLERGEN_CODES, SUITABLE_CODES } from "../../public/assets/allergens.js";
import { WORKSHOP_BOOKLET_2027 } from "../../public/assets/workshop-booklet.js";

export const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {
  status, headers: {"content-type":"application/json; charset=utf-8", "cache-control":"no-store", ...headers}
});
export const store = () => getStore({ name: "lwlat-events-data", consistency: "strong" });
export async function readJSON(key, fallback){
  const raw = await store().get(key);
  if(!raw) return fallback;
  try{return JSON.parse(raw)}catch{return fallback}
}
export async function writeJSON(key, value){ await store().set(key, JSON.stringify(value)); }

// Read-modify-write that cannot lose another request's changes. If someone
// else saved the key between our read and our write, we re-read and retry.
// The mutator returns {value, result}; value === undefined means "no write".
export async function updateJSON(key, fallback, mutator, attempts=8){
  const s = store();
  for(let i=0;i<attempts;i++){
    const current = await s.getWithMetadata(key);
    let value = fallback;
    if(current?.data){ try{ value = JSON.parse(current.data) }catch{ value = fallback } }
    const out = await mutator(structuredClone(value));
    if(out.value === undefined) return out.result;
    // Netlify Blobs returns an ETag with every read. If it ever does not, fall
    // back to a plain write (the behaviour of v4.9) rather than failing.
    const conditions = current?.etag ? { onlyIfMatch: current.etag } : current ? {} : { onlyIfNew: true };
    const write = await s.set(key, JSON.stringify(out.value), conditions);
    if(write.modified) return out.result;
    await new Promise(r => setTimeout(r, 40 + Math.random()*120));
  }
  throw new Error("The system is busy. Please try again in a moment.");
}

// ---------- Admin sessions ----------
const secret = () => {
  const value = process.env.SESSION_SECRET || "";
  return value.length >= 32 ? value : null;
};
export const sessionConfigured = () => Boolean(secret());
function sign(value){return crypto.createHmac("sha256", secret()).update(value).digest("hex")}
export function makeToken(){
  const exp=Date.now()+1000*60*60*12; const value=String(exp); return `${value}.${sign(value)}`;
}
export function validToken(token){
  if(!token || !secret()) return false; const [value,sig]=token.split("."); if(!value||!sig||Number(value)<Date.now()) return false;
  const expected=sign(value); try{return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))}catch{return false}
}
export function cookieValue(request,name){
  const cookie=request.headers.get("cookie")||"";
  return cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.split("=").slice(1).join("=") || "";
}
export function requireAdmin(request){return validToken(cookieValue(request,"lwlat_admin"))}
export const clientIp = request => request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

// ---------- Text helpers ----------
export const slug = text => String(text||"course").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70);
export const clean = (value, max=300) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
export const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
export const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||""));
export const STAFF_DOMAIN = "@lwlat.org.uk";
// Email endings that count as staff addresses. The Trust's own is always
// included. Administrators add schools with their own email ending.
const cleanDomain = d => String(d||"").trim().toLowerCase().replace(/^@+/,"");
export function staffDomains(e){
  const list = (Array.isArray(e?.staffDomains) ? e.staffDomains : []).map(cleanDomain).filter(d => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d));
  return [...new Set(["lwlat.org.uk", ...list])];
}
export const isStaffEmail = (email, e) => staffDomains(e).some(d => String(email).toLowerCase().endsWith("@" + d));
export const domainList = e => { const d = staffDomains(e).map(x => "@" + x); return d.length > 1 ? `${d.slice(0,-1).join(", ")} or ${d.at(-1)}` : d[0]; };

// Today's date in the UK, as YYYY-MM-DD, for deadline checks.
export const todayUK = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(new Date());

// ---------- EduHub settings ----------
export const BOOKING_STATUSES = ["coming-soon","open","closed"];
export const PHASES = ["primary","secondary","central"];
export const PHASE_NAMES = {primary:"Primary",secondary:"Secondary",central:"Central Trust"};
// Who someone is booking EduHub as. Trustees have no school, so they follow
// the central Trust staff rounds.
export const ATTENDEE_ROLES = {staff:"Member of staff",governor:"Governor",trustee:"Trustee"};
const isTime = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||""));
export const defaults = {
  eduhub:{title:"EduHub 2027: Better Together",date:"2027-01-05",time:"08:00 to 15:00",venue:"Babington Academy",description:"Our annual Trust-wide event for Learning Without Limits Academy Trust staff.",capacity:0,bookingStatus:"coming-soon",bookingDeadline:"",foodChoices:[],askDietary:true,askAccessibility:true,allowNoFood:false,privacyNoticeUrl:"",contactEmail:"",recognitionUrl:"https://forms.cloud.microsoft/e/PsKimNCMdT",speakerBookingOpen:false,speakerCode:"",allowGovernors:true,staffDomains:["wykencroft.coventry.school.uk"],showAgenda:true,schools:[],rounds:[],workshops:[],keynote:{},agenda:[],requireSessionChoice:true}
};
// Fields edited on the admin "EduHub sessions" screen. Each admin screen saves
// only its own fields, so the two screens cannot overwrite each other.
export const PROGRAMME_FIELDS = ["schools","rounds","workshops","keynote","agenda","showAgenda","requireSessionChoice","sessions"];

// Recommended audience is a guide shown to staff. It does not limit booking.
export const AUDIENCES = { all: "Open to all", educators: "All educators", leaders: "Anyone who leads a team" };

function uniqueIds(items){
  const seen=new Set();
  return items.map(c=>{ let id=c.id, n=2; while(seen.has(id)) id=`${c.id}-${n++}`; seen.add(id); return {...c,id}; });
}
const cleanId = (v, fallback) => (String(v||"").toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,50)) || fallback;
const photoFields = x => ({
  photoId: /^[a-f0-9-]{36}$/.test(String(x.photoId||"")) ? x.photoId : "",
  photoPath: /^\/assets\/speakers\/[a-z0-9-]+\.(jpg|png|svg)$/.test(String(x.photoPath||"")) ? x.photoPath : ""
});
export function normaliseSchool(s, i=0){
  if(!s || typeof s!=="object") return null;
  const name=clean(s.name,120); if(!name) return null;
  return { id: clean(s.id,60) || `${slug(name)}-${i+1}`, name, phase: PHASES.includes(s.phase) ? s.phase : "primary" };
}
export function normaliseRound(r, i=0){
  if(!r || typeof r!=="object") return null;
  // phases: which school groups attend this round. Empty means everyone.
  return { id: cleanId(r.id, `round-${i+1}`), label: clean(r.label,60) || `Round ${i+1}`,
    startTime: isTime(r.startTime) ? r.startTime : "", endTime: isTime(r.endTime) ? r.endTime : "",
    phases: Array.isArray(r.phases) ? PHASES.filter(p => r.phases.includes(p)) : [] };
}
export function normaliseWorkshop(w, i=0){
  if(!w || typeof w!=="object") return null;
  const title=clean(w.title,150); if(!title) return null;
  return {
    id: cleanId(w.id, `${slug(title).slice(0,40)}-${i+1}`),
    title,
    speakerName: clean(w.speakerName,120),
    speakerRole: clean(w.speakerRole,150),
    speakerBio: clean(w.speakerBio,2500),
    ...photoFields(w),
    description: clean(w.description,4000),
    warning: clean(w.warning,300),
    recommended: AUDIENCES[w.recommended] ? w.recommended : "all",
    room: clean(w.room,100),
    capacity: Math.max(0, Math.floor(Number(w.capacity) || 0)),
    rounds: Array.isArray(w.rounds) ? w.rounds.map(x=>cleanId(x,"")).filter(Boolean) : [],
    adminNotes: clean(w.adminNotes,1000),
    // Invitation-only workshops are hidden from the public page and can only
    // be booked through their private link, which carries this code.
    inviteOnly: w.inviteOnly === true,
    inviteCode: /^[A-Za-z0-9]{12,40}$/.test(String(w.inviteCode||"")) ? w.inviteCode : ""
  };
}
// Safety warnings from the workshop booklet (such as allergens in the food
// tasting) always show, even on workshops saved before warnings existed.
// An administrator can change the wording but cannot leave it blank.
function bookletWarning(w){
  const match = WORKSHOP_BOOKLET_2027.workshops.find(b => b.warning && (b.id === w.id || b.title.toLowerCase() === w.title.toLowerCase()));
  return match ? match.warning : "";
}
export function normaliseKeynote(k){
  k = k && typeof k === "object" ? k : {};
  return { name: clean(k.name,120), role: clean(k.role,150), title: clean(k.title,150), bio: clean(k.bio,3000),
    startTime: isTime(k.startTime) ? k.startTime : "", endTime: isTime(k.endTime) ? k.endTime : "", ...photoFields(k) };
}
// One line of the structure of the day. groups: who it applies to (empty
// means everyone). A "workshop" line can point at a round, so each person's
// timeline can show the workshop they chose for it.
export const AGENDA_KINDS = ["general","arrival","keynote","workshop","break","lunch","awards"];
export function normaliseAgendaItem(a, i=0){
  if(!a || typeof a!=="object") return null;
  const title=clean(a.title,150); if(!title) return null;
  return { id: cleanId(a.id, `item-${i+1}`), startTime: isTime(a.startTime) ? a.startTime : "", endTime: isTime(a.endTime) ? a.endTime : "",
    title, detail: clean(a.detail,400), location: clean(a.location,120),
    groups: Array.isArray(a.groups) ? PHASES.filter(p => a.groups.includes(p)) : [],
    kind: AGENDA_KINDS.includes(a.kind) ? a.kind : "general", roundId: cleanId(a.roundId, "") };
}

// Versions 5.1 and 5.2 stored a flat list of sessions, each with its own
// time. Turn those into rounds (one per distinct time) and workshops.
function legacySessionsToProgramme(list){
  const rounds=[], workshops=[];
  for(const [i,s] of list.entries()){
    if(!s || !String(s.title||"").trim()) continue;
    const key=`${s.startTime||""}-${s.endTime||""}`;
    let r=rounds.find(x=>x.key===key);
    if(!r) rounds.push(r={key,id:`round-${rounds.length+1}`,label:`Round ${rounds.length+1}`,startTime:s.startTime,endTime:s.endTime});
    workshops.push({...s,id:s.id||`session-${i+1}`,recommended:"all",rounds:[r.id]});
  }
  return { rounds: rounds.sort((a,b)=>(a.startTime||"99").localeCompare(b.startTime||"99")), workshops };
}
// Every workshop in every round it runs in, as one bookable "session".
// A session id is "<workshop id>@<round id>".
export function programmeSessions(rounds, workshops){
  const out=[];
  for(const r of rounds){
    for(const w of workshops){
      if(w.rounds.length && !w.rounds.includes(r.id)) continue;
      const {rounds:_r, adminNotes:_n, ...rest}=w;
      out.push({...rest, id:`${w.id}@${r.id}`, workshopId:w.id, roundId:r.id, roundLabel:r.label, roundPhases:r.phases, startTime:r.startTime, endTime:r.endTime});
    }
  }
  return out;
}
// The rounds someone attends depend on their school's phase (primary,
// secondary or central). Without a phase, every round is offered.
export const sessionOpenTo = (s, phase) => !phase || !Array.isArray(s.roundPhases) || !s.roundPhases.length || s.roundPhases.includes(phase);
export const slotKey = s => s.roundId || `${s.startTime||""}-${s.endTime||""}`;
export const slotLabel = s => {
  const times = s.startTime ? `${s.startTime}${s.endTime?` to ${s.endTime}`:""}` : "";
  if(s.roundLabel) return times ? `${s.roundLabel}, ${times}` : s.roundLabel;
  return times || "Time to be confirmed";
};
export const sessionPlacesTaken = (bookings, sessionId) =>
  bookings.filter(b => b.itemId === EDUHUB_ID && confirmedBooking(b) && Array.isArray(b.sessionIds) && b.sessionIds.includes(sessionId)).length;

export function normaliseFoodChoice(choice, index=0){
  if(typeof choice === "string") choice = { name: choice };
  if(!choice || typeof choice !== "object") return null;
  const name = clean(choice.name, 120);
  if(!name) return null;
  const allergens = Array.isArray(choice.allergens) ? ALLERGEN_CODES.filter(c => choice.allergens.includes(c)) : [];
  return {
    id: clean(choice.id, 60) || `${slug(name)}-${index+1}`,
    group: clean(choice.group, 60),
    name,
    description: clean(choice.description, 300),
    allergens,
    cerealTypes: allergens.includes("GL") ? clean(choice.cerealTypes, 80) : "",
    treeNutTypes: allergens.includes("TN") ? clean(choice.treeNutTypes, 120) : "",
    suitableFor: Array.isArray(choice.suitableFor) ? SUITABLE_CODES.filter(c => choice.suitableFor.includes(c)) : [],
    allergensConfirmed: Boolean(choice.allergensConfirmed)
  };
}

// Brings any stored EduHub record (including pre-v5 records) into the current
// shape. Older versions stored a true/false "bookingOpen" flag even though the
// public site said "Bookings Open Soon". That flag is deliberately ignored: a
// record without an explicit bookingStatus is treated as "coming soon", so
// bookings only open when an administrator chooses "Open" in the dashboard.
export function normaliseEduhub(raw){
  const e = { ...defaults.eduhub, ...(raw && typeof raw === "object" ? raw : {}) };
  const foodChoices = uniqueIds((Array.isArray(e.foodChoices) ? e.foodChoices : []).map(normaliseFoodChoice).filter(Boolean));
  let rawRounds = Array.isArray(e.rounds) ? e.rounds : [], rawWorkshops = Array.isArray(e.workshops) ? e.workshops : [];
  if(!rawRounds.length && !rawWorkshops.length && Array.isArray(e.sessions) && e.sessions.length){
    ({ rounds: rawRounds, workshops: rawWorkshops } = legacySessionsToProgramme(e.sessions));
  }
  const rounds = uniqueIds(rawRounds.map(normaliseRound).filter(Boolean));
  const roundIds = new Set(rounds.map(r => r.id));
  const workshops = uniqueIds(rawWorkshops.map(normaliseWorkshop).filter(Boolean))
    .map(w => ({ ...w, rounds: w.rounds.filter(id => roundIds.has(id)), warning: w.warning || bookletWarning(w) }));
  const programme = { rounds, workshops };
  return {
    title: clean(e.title, 150) || defaults.eduhub.title,
    date: isDate(e.date) ? e.date : defaults.eduhub.date,
    time: clean(e.time, 60) || "08:00 to 15:00",
    venue: clean(e.venue, 150),
    description: clean(e.description, 2000),
    capacity: Math.max(0, Math.floor(Number(e.capacity) || 0)),
    bookingStatus: BOOKING_STATUSES.includes(raw?.bookingStatus) ? raw.bookingStatus : "coming-soon",
    bookingDeadline: isDate(e.bookingDeadline) ? e.bookingDeadline : "",
    foodChoices,
    askDietary: e.askDietary !== false,
    askAccessibility: e.askAccessibility !== false,
    allowNoFood: Boolean(e.allowNoFood),
    privacyNoticeUrl: /^https:\/\//i.test(String(e.privacyNoticeUrl||"")) ? clean(e.privacyNoticeUrl, 300) : "",
    speakerBookingOpen: Boolean(e.speakerBookingOpen),
    staffDomains: staffDomains(e),
    allowGovernors: e.allowGovernors !== false,
    speakerCode: /^[A-Za-z0-9]{12,40}$/.test(String(e.speakerCode||"")) ? e.speakerCode : "",
    recognitionUrl: /^https:\/\//i.test(String(e.recognitionUrl||"")) ? clean(e.recognitionUrl, 300) : "",
    contactEmail: isEmail(e.contactEmail) ? clean(e.contactEmail, 120).toLowerCase() : "",
    schools: uniqueIds((Array.isArray(e.schools)?e.schools:[]).map(normaliseSchool).filter(Boolean)),
    ...programme,
    keynote: normaliseKeynote(e.keynote),
    showAgenda: e.showAgenda !== false,
    // Until an administrator saves their own timeline, use the structure of
    // the day from the booklet, so staff always see it.
    agenda: uniqueIds((Array.isArray(e.agenda) && e.agenda.length ? e.agenda : WORKSHOP_BOOKLET_2027.agenda).map(normaliseAgendaItem).filter(Boolean))
      // A workshop line links to its round, or failing that to the round that starts at the same time.
      .map(a => ({ ...a, roundId: rounds.some(r => r.id === a.roundId) ? a.roundId
        : a.kind === "workshop" && a.startTime ? (rounds.find(r => r.startTime === a.startTime)?.id || "") : "" }))
      .sort((a,b)=>(a.startTime||"99").localeCompare(b.startTime||"99")),
    sessions: programmeSessions(programme.rounds, programme.workshops),
    requireSessionChoice: e.requireSessionChoice !== false,
    updatedAt: e.updatedAt || ""
  };
}

// What the public can actually do right now, after deadlines are applied.
export function eduhubEffectiveStatus(e){
  if(e.bookingStatus !== "open") return e.bookingStatus;
  if(e.bookingDeadline && todayUK() > e.bookingDeadline) return "closed";
  if(e.date && todayUK() > e.date) return "closed";
  return "open";
}

// ---------- Professional Learning ----------
export const COURSE_STATUSES = ["draft","published","archived"];
export const CATERING_TYPES = ["none","refreshments","lunch","other"];

export function courseSessions(c){
  return Array.isArray(c.sessions) && c.sessions.length ? c.sessions : (c.date||c.time ? [{label:"Session 1",date:c.date||"",time:c.time||""}] : []);
}
export function courseBookingClosedReason(c){
  if(c.bookingOpen === false) return "Bookings are closed for this opportunity.";
  if(c.bookingDeadline && todayUK() > c.bookingDeadline) return "The booking deadline for this opportunity has passed.";
  const dates = courseSessions(c).map(s => s.date).filter(isDate).sort();
  if(dates.length && todayUK() > dates[0]) return "This opportunity has already started, so new bookings cannot be taken.";
  return "";
}

// ---------- Bookings ----------
export const EDUHUB_ID = "eduhub-2027";
export const activeBooking = b => !b.cancelled && b.status !== "cancelled";
export const confirmedBooking = b => activeBooking(b) && !b.waitingList;
export const isSpeaker = b => b.role === "speaker";
// Speakers' lunch bookings never use up staff places.
export function placesTaken(bookings, itemId){
  return bookings.filter(b => b.itemId === itemId && confirmedBooking(b) && !isSpeaker(b)).length;
}
export function bookingStatusOf(b){
  if(!activeBooking(b)) return "cancelled";
  return b.waitingList ? "waiting" : "booked";
}
// True when someone may see and book an invitation-only workshop.
export function hasInvite(w, code){
  if(!w?.inviteOnly) return true;
  if(!w.inviteCode || typeof code !== "string" || code.length !== w.inviteCode.length) return false;
  return crypto.timingSafeEqual(Buffer.from(code), Buffer.from(w.inviteCode));
}
export const newSpeakerCode = () => crypto.randomBytes(15).toString("base64url").replace(/[^A-Za-z0-9]/g,"").slice(0,20).padEnd(16,"x");
export function speakerAccess(e, code){
  if(!e.speakerCode || typeof code !== "string" || code.length !== e.speakerCode.length) return false;
  return crypto.timingSafeEqual(Buffer.from(code), Buffer.from(e.speakerCode));
}
export function makeReference(prefix){
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  return `${prefix}-${[...bytes].map(b => alphabet[b % alphabet.length]).join("")}`;
}
