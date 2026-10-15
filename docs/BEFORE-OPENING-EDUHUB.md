# Before opening EduHub 2027 bookings

Allergy and dietary information is health information, which UK GDPR treats as special category data. Please complete this checklist before choosing **Open** in admin.

## 1. Data Protection Officer sign-off

The booking form collects the following:

| Information | Required? | Who sees it |
| --- | --- | --- |
| First name, surname, @lwlat.org.uk email, school or team | Yes | Event administrators |
| Workshop choices | Yes, when workshops exist | Administrators, and workshop leaders through the register |
| Job title, telephone | Optional | Event administrators |
| Food choice | Yes, when food choices exist | Administrators and caterer |
| Dietary requirements or allergies | Optional (admin can switch the question off) | Administrators and caterer |
| Accessibility requirements | Optional (admin can switch the question off) | Administrators, and others only where needed |
| Additional notes | Optional | Event administrators |

How it is handled:

- Bookings are stored in Netlify Blobs, in the Learning Hub's Netlify account. Netlify's storage location should be confirmed with the DPO.
- A confirmation email is sent to the person booking from a Trust Microsoft 365 mailbox. It contains their name, booking details, sessions and food choice, but not their dietary or accessibility details. Emails are not kept in the mailbox's Sent Items.
- Each ticket's QR code holds a web link with a random booking number and a signature, but no personal details. Anyone who opens the link sees the person's first name, booking reference and sessions. Signed-in administrators also see school, food, dietary and accessibility details, so door staff can help people on arrival.
- Only someone with the admin password can see bookings. There are no individual admin accounts, so everyone who signs in shares one password.
- The **caterer's list** download contains names, school, food choice and dietary details. It leaves out email addresses and telephone numbers.
- Administrators can cancel, edit or permanently delete a booking.
- Nothing is deleted automatically. A retention period needs to be agreed. After the event, export what is needed and delete the bookings in admin.

Wording shown to staff beside the consent box:

> We will use the details on this form to organise EduHub 2027. Your food choice and any dietary or allergy information will be shared with the event caterer. Accessibility information will only be shared with the people who need it to support you on the day.

If the Trust has an online privacy notice, add its link under **Privacy notice link** in admin, and it will appear after this wording.

**Record of approval**

| | |
| --- | --- |
| DPO name | |
| Date approved | |
| What was approved | |
| Conditions or changes requested | |
| Agreed retention period | |

## 2. Caterer check

The menu in admin can be filled in from the supplied allergen matrix with **Fill in from the allergen matrix**. Each item then has to be ticked **Allergen details checked with the caterer** after it has been confirmed. Unchecked items are marked with a yellow edge in admin.

Points in the matrix to raise with the caterer:

1. **Butter Quorn Curry and Rice** lists gluten and tree nuts but not milk. A butter curry would normally contain milk.
2. **Quorn** products usually contain egg. The matrix shows egg for the Quorn Chilli but not for the Quorn Sausage Casserole or the Butter Quorn Curry.
3. **Mayonnaise** (Chicken Mayo, Tuna Mayo) sometimes contains mustard. Mustard is not ticked.
4. **Pesto** sometimes contains cashew or other tree nuts, and usually contains hard cheese. Milk is ticked for this sandwich because of the mozzarella, but tree nuts are not.
5. **Ham** often contains sulphites. Sulphites are not ticked for the Classic Ham Salad Sandwich.
6. Which items are vegetarian or vegan? The matrix does not say, so the site does not show these labels yet.
7. The matrix spells "Chicken Salad Sanwich". The site uses "Sandwich".

When the menu is confirmed, ask for an updated PDF if anything changes, and replace `public/documents/EduHub-2027-Allergen-Matrix.pdf` with it.

## 3. Schools, rounds and workshops

- [ ] Every school and central team is in the list with the right phase. The phase decides which two rounds each person is offered.
- [ ] Each round has the right groups ticked. The starting point is primaries in rounds 2 and 3, and secondaries and central staff in rounds 1 and 4. **Please confirm where central staff should go.**
- [ ] Every workshop has a room and, where the room is small, a number of places per round. "Sleep Better, Feel Calmer" is set to 25, as the booklet says.
- [ ] Check the two placeholder titles: "Inclusive Leadership" (Mandy Coalter) and "Hollie's Story" (Nick Gazzard). The booklet gives no titles for these.
- [ ] Add Charles's workshop (row 12 of the booklet) when the details arrive.
- [ ] Speakers have agreed to their photo and biography being shown on the public EduHub page.
- [ ] Workshop registers now include dietary needs, so the food tasting workshop can plan. The DPO should be aware that workshop leaders may see this.

## 4. Event details

- [ ] Start and finish times entered
- [ ] Capacity entered (0 means no limit)
- [ ] Booking deadline entered
- [ ] Organiser contact email entered
- [ ] Preview checked on a phone and a computer
