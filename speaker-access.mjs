// Tells the speaker lunch page whether its private link is valid and open.
import { json, readJSON, normaliseEduhub, speakerAccess, todayUK } from "./_utils.mjs";
export default async request => {
 const code = new URL(request.url).searchParams.get("code") || "";
 const e = normaliseEduhub(await readJSON("eduhub", null));
 if(!speakerAccess(e, code)) return json({ valid: false });
 return json({ valid: true, open: e.speakerBookingOpen && !(e.date && todayUK() > e.date) });
};
