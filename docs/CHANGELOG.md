# Changelog

## Version 5.2: confirmation emails and QR check-in

### New
- Booking confirmation emails sent from a Trust mailbox through Microsoft 365. They include the booking details, sessions, food choice and a QR code ticket. Waiting-list bookings get a waiting-list email, and receive their ticket when an administrator gives them a place.
- Each booking has its own ticket page at `/ticket/`, reached through the QR code or a link. Links are signed, so they cannot be guessed.
- Scanning in: door staff sign in to admin on their phone and scan tickets with the phone camera. A green, amber or red screen shows the result. Check-ins can be undone.
- The confirmation screen shows the QR code straight away, even before email is set up.
- Admin shows email status and check-in status for every booking, with Check in, Resend email and View ticket buttons, and a test email button on the Overview page.
- Exports include check-in times and email status. Session registers mark who checked in.
- Set-up instructions for IT in `docs/EMAIL-SETUP-FOR-IT.md`.

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
