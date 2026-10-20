# Changelog

## Version 5.10: larger logos and link previews

### Changed
- **Larger logos.** The EduHub and Trust logo files have wide empty margins, which made the artwork look small. The pages now trim those margins automatically when they load (`public/assets/logo-trim.js`), so any replacement logo is trimmed too. The EduHub logo panel is larger, and on phones it sits above the title.
- **Link previews.** The EduHub page now has Open Graph tags, so a link shared in Teams, Outlook, WhatsApp or social media shows the EduHub logo, title and a one-line description.

## Version 5.9.1: the Without Limits Lab

### New
- **The Without Limits Lab: design your year ahead**, with Charles Dall’Omo and Rachel Hunnybun of Train Together, is now in the workshop booklet, open to all. If the live site already has its workshops saved, **Fill in from the workshop booklet** adds only this one and leaves everything else as it is. Its photo is uploaded in admin.

## Version 5.9: design pass on the EduHub page

### Changed
- **Page banner.** The date, time, venue and booking status now sit in a white bar along the bottom of the banner, replacing the separate "Event information" and "Bookings" panels lower down. The **Book your place** button is Trust yellow, with a "See the day" link beside it. The logo panel is smaller.
- **Structure of the day** is the main feature of the page. The heading and "Showing the day for" sit on the left and stay in view while the timeline scrolls. Times are set larger, and each line has a coloured bar for its type (keynote teal, workshops purple, breaks and lunch yellow, awards gold). Workshop rounds have a light purple background, because they are the part people need to act on.
- Small labels across the site are now in sentence case rather than spaced capitals.
- The email address rules for staff, governors and trustees now sit under **Book your place**.
- The "LwLAT staff only" tags now say the event is for staff, governors and trustees.
- Larger tick boxes and radio buttons on the booking form.

## Version 5.8: more staff email addresses

### New
- **Staff email addresses** under EduHub 2027 → Event details. Members of staff can book with any listed email ending. @lwlat.org.uk is always accepted, and @wykencroft.coventry.school.uk is included from the start. The form's guidance and error messages list the accepted endings.

## Version 5.7: "Who are you?" and the Recognition Awards lightbox

### New
- **Who are you?** On a first visit, a lightbox asks people to choose: primary school staff, secondary school staff, central Trust staff, governor of a primary school, governor of a secondary school, or trustee. The structure of the day then shows their version, under "Showing the day for…" with a **Change** button. The choice also sets "I am booking as" on the form, and the browser remembers it.
- **LwLAT Better Together Recognition Awards 2027** lightbox in gold, with confetti and sparklers. It opens after booking (and in preview), and from a "Nominate a colleague" button on the awards line of the timeline. People who ask their device to reduce motion see it without animation.
- The awards lightbox uses `public/assets/awards-backdrop.jpg` as its backdrop when that file is uploaded, and a matching gold background until then.
- The awards are called "LwLAT Better Together Recognition Awards 2027" on the confirmation screen, in the email and in the structure of the day. The nomination box on the confirmation screen and in the email uses the same dark bronze and gold as the awards lightbox.

## Version 5.6: workshops chosen one round at a time

### Changed
- Workshop choice is now a step-by-step picker. Only the first round is shown, as a grid of compact tiles. Choosing a workshop collapses that round into a summary with a **Change** button and opens the next round. Workshops already chosen are greyed out, and later rounds wait their turn, so nobody can pick two in one round by mistake.
- The structure of the day appears straight after the page banner, so people see how the day works before booking. Until an administrator saves their own, the structure from the "Structure of the day" document is shown automatically. Admin has a tick box to hide it.
- Workshop lines in the timeline link to the round that starts at the same time, so each person's "Your day" shows their chosen workshop and room.
- In preview mode, completing the form shows the real confirmation screen, including the recognition award reminder, marked as a preview. Nothing is saved, and "Back to the form" returns to the form.

## Version 5.5: speaker lunches, governors and trustees

### New
- **Speaker lunch form** at `/eduhub/speakers/`, opened through a private link from admin (EduHub 2027 → Speaker lunch bookings). Speakers can use any email address and choose the session they are leading, their lunch, dietary and accessibility needs. They get a confirmation, a QR ticket and an email. Speaker bookings do not use up staff places, are marked as speakers in admin, and appear in the catering summary and the caterer's list. The form has its own open or closed switch, and the link can be replaced at any time.
- **Governors and trustees** can book EduHub. The form asks "I am booking as" (member of staff, governor or trustee). Governors and trustees can use any email address. Governors choose the school they govern, which decides their workshop rounds. Trustees choose no school and follow the central Trust rounds. A switch in admin turns this on or off.
- Bookings, exports and workshop registers show whether each person is staff, a governor, a trustee or a speaker.

## Version 5.4: a more visual EduHub page

### New
- **Structure of the day** timeline on the EduHub page, with tabs for primary, secondary and central Trust staff. Editable in admin under EduHub sessions, and filled in from the structure-of-the-day document by the booklet button.
- **Your day** beside the booking form. It switches to the person's group when they choose their school, and fills in each workshop and room as they choose them.
- Workshop **tiles** showing only the speaker photo, title, speaker name and recommended audience. Selecting a tile opens a **lightbox** with the description, speaker biography, room and round times.
- The booking form uses the same compact tiles, with a "More about this workshop" link to the lightbox.
- Keynote banner with an "About Graham" lightbox.
- A **warning** field for each workshop (warnings from the workshop booklet always apply, including on workshops saved before warnings existed), shown in strong Trust red: a band across the tile photo with the full wording beneath, a red box in the lightbox, and a red strip on the booking form. "10 Things I Love About Food" carries a warning that the tasting food may contain a variety of allergens, including nuts.

## Version 5.3: workshop rounds, keynote and the workshop booklet

### Changed
- EduHub sessions are now **workshops** that run in **rounds**. Each workshop is entered once and runs in every round, or only the rounds ticked. Places are per round.
- Each round lists which groups attend (primary, secondary, central Trust). The phase of the school someone chooses decides their rounds. Staff choose one workshop in each of their rounds and cannot choose the same workshop twice.
- The recommended audience (open to all, all educators, anyone who leads a team) is shown as a guide. It does not limit booking.
- Sessions saved in version 5.1 or 5.2 are converted into rounds and workshops automatically.

### New
- A keynote section, shown on the EduHub page with photo, timing and biography. Not bookable.
- **Fill in from the workshop booklet**: loads the keynote, the four rounds with their times (10:30, 11:20, 12:10 and 12:55) and twelve workshops with speaker photos from the supplied booklet. Nothing is saved until an administrator presses Save.
- Workshops have an "About the speaker" section and private admin notes. Descriptions support bullet points.
- The EduHub page shows the full programme: keynote, rounds and every workshop.
- Workshop registers now include dietary needs, for workshops such as the food tasting.

## Version 5.2: confirmation emails and QR check-in

### New
- Booking confirmation emails sent from a Trust mailbox through Microsoft 365. They include the booking details, sessions, food choice and a QR code ticket. Waiting-list bookings get a waiting-list email, and receive their ticket when an administrator gives them a place.
- Each booking has its own ticket page at `/ticket/`, reached through the QR code or a link. Links are signed, so they cannot be guessed.
- Scanning in: door staff sign in to admin on their phone and scan tickets with the phone camera. A green, amber or red screen shows the result. Check-ins can be undone.
- The confirmation screen shows the QR code straight away, even before email is set up.
- Admin shows email status and check-in status for every booking, with Check in, Resend email and View ticket buttons, and a test email button on the Overview page.
- Exports include check-in times and email status. Session registers mark who checked in.
- Set-up instructions for IT in `docs/EMAIL-SETUP-FOR-IT.md`.
- A reminder to nominate a colleague for a recognition award, with a button to the Microsoft Form, on the EduHub confirmation screen and in the confirmation email. The link is set under **EduHub 2027 → Event details** and can be changed or removed.

## Version 5.1: EduHub sessions

### New
- **EduHub sessions** screen in admin. Each session has a title, start and finish time, room or area, speaker name and role, speaker photo, brief description, optional number of places, and who it is aimed at (primary, secondary and/or central Trust staff).
- **Schools and teams** list in admin, each marked primary, secondary or central. Names can be pasted in several at a time.
- On the booking form, staff choose their school from a list. They are then offered only the sessions aimed at their phase, grouped by time slot, and choose one in each slot. Full sessions are shown as full.
- The server checks every session choice, so nobody can book a session outside their phase or over its limit by tampering with the form.
- A public programme of all sessions, with speaker photos, appears on the EduHub page.
- Session numbers in admin, with a printable register (CSV) for each session.
- Administrators can change a person's school or sessions, including placing them in a full session or one outside their phase.
- Photos are shrunk in the browser before upload, so pages stay quick.

## Version 5.0: EduHub staff booking

### Fixed
- **EduHub bookings could be made while the site said "Bookings Open Soon".** The server accepted bookings whenever a hidden setting was "Open", and that was the default. There is now one booking status (Coming soon, Open or Closed) which the server enforces. Settings saved by version 4.9 are treated as Coming soon until an administrator chooses Open.
- **EduHub food choices were never part of a real booking.** The live form had no food question. Food choice is now required, checked on the server and saved with each booking.
- **Admin sessions could be faked if `SESSION_SECRET` was missing.** The code fell back to a known value. Sign-in now refuses to work without a proper secret.
- **Two bookings made at the same moment could overwrite each other**, losing one of them and allowing overbooking. Saves now check that nothing has changed since they read the data, and retry if it has.
- **Bookings could carry any extra data a sender added**, including marking themselves as not on the waiting list. Only the expected fields are now kept, with length limits.
- **Course booking deadlines were shown but not enforced.** They now are, and courses that have started stop taking bookings.
- **CSV exports could run formulas in Excel** if someone typed one into the form. Such cells are now kept as plain text.
- The same email address could book the same event more than once.
- Admin sign-in did not limit repeated wrong guesses. After 8 failures it now waits 15 minutes.
- The site published its server code and notes. Only the `public` folder is now published.

### New
- A full EduHub page at `/eduhub/`, with the working booking form when bookings are open.
- Food choices with headings, descriptions, the 14 allergens, cereal and tree nut types, and "suitable for" labels. Each option shows its allergens on the form, with the allergen matrix linked directly beneath.
- **Fill in from the allergen matrix** button and a "checked with the caterer" tick for each item.
- Confirmation screen with a booking reference, an "Add to my calendar" file and a print option.
- Capacity with an automatic waiting list, places-left display and a booking deadline.
- Admin booking tools: filter by event and status, edit, cancel, reinstate, give a waiting-list place, permanently delete, and private admin notes.
- Catering summary with totals per food choice and a caterer's list download.
- Organiser contact email, privacy notice link and consent box.
- Old `/eduhub-preview.html` links now open the new preview.
- Automated tests for the server and for the full journey in a browser.
