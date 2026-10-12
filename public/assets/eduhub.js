import { allergenSummary, SUITABLE_FOR } from './allergens.js';

const $ = s => document.querySelector(s);
const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmtDate = value => value
  ? new Intl.DateTimeFormat('en-GB',{dateStyle:'full'}).format(new Date(value+'T12:00:00'))
  : 'Date to be confirmed';

const STAFF_DOMAIN = '@lwlat.org.uk';
const NO_FOOD = 'no-food';
// ?preview=1 shows the finished form whatever the booking status, but never sends anything.
const preview = new URLSearchParams(location.search).get('preview') === '1';
const form = $('#eduhub-form');
let eduhub = {};

const STATUS_COPY = {
  'coming-soon': { cta:'Bookings Open Soon', heading:'Bookings open soon', text:'Bookings for EduHub 2027 have not opened yet. Please check back soon.' },
  'open': { cta:'Book your place', heading:'Bookings are open', text:'Book your place using the form below. It only takes a few minutes.' },
  'closed': { cta:'Bookings closed', heading:'Bookings are closed', text:'Bookings for EduHub 2027 are now closed. If you need to make a late change, please contact the event organiser.' }
};

function foodOptionHtml(choice){
  const summary = allergenSummary(choice);
  const allergens = summary
    ? `<span class="food-allergens"><strong>Contains:</strong> ${esc(summary)}</span>`
    : choice.allergensConfirmed
      ? '<span class="food-allergens">Contains none of the 14 main allergens</span>'
      : '<span class="food-allergens">Please check the allergen matrix for this option</span>';
  const tags = (choice.suitableFor || []).map(code => SUITABLE_FOR.find(s => s.code === code)?.name).filter(Boolean);
  return `<label class="food-option">
    <input type="radio" name="foodChoiceId" value="${esc(choice.id)}" required>
    <span class="food-option-body">
      <span class="food-name">${esc(choice.name)}</span>
      ${tags.length ? `<span class="food-tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</span>` : ''}
      ${choice.description ? `<span class="food-description">${esc(choice.description)}</span>` : ''}
      ${allergens}
    </span>
  </label>`;
}

function renderFood(){
  const choices = Array.isArray(eduhub.foodChoices) ? eduhub.foodChoices : [];
  $('#food-field').classList.toggle('hidden', !choices.length);
  if(!choices.length){ $('#food-options').innerHTML = ''; return; }
  const groups = [];
  for(const c of choices){
    const name = c.group || '';
    let g = groups.find(x => x.name === name);
    if(!g) groups.push(g = { name, items: [] });
    g.items.push(c);
  }
  let html = groups.map(g => `
    ${g.name ? `<p class="food-group">${esc(g.name)}</p>` : ''}
    ${g.items.map(foodOptionHtml).join('')}`).join('');
  if(eduhub.allowNoFood){
    html += `<label class="food-option"><input type="radio" name="foodChoiceId" value="${NO_FOOD}" required>
      <span class="food-option-body"><span class="food-name">I do not need food</span></span></label>`;
  }
  $('#food-options').innerHTML = html;
}

function render(){
  const e = eduhub;
  const status = e.effectiveStatus || 'coming-soon';
  const copy = STATUS_COPY[status] || STATUS_COPY['coming-soon'];
  document.title = `${e.title || 'EduHub 2027'} | Learning Without Limits Learning Hub`;
  $('#edu-title').textContent = e.title || 'EduHub 2027: Better Together';
  $('#side-title').textContent = e.title || 'EduHub 2027';
  if(e.description) $('#edu-description').textContent = e.description;
  $('#edu-date').textContent = $('#side-date').textContent = fmtDate(e.date || '2027-01-05');
  $('#edu-time').textContent = e.time || 'To be confirmed';
  $('#side-time').textContent = e.time || 'Time to be confirmed';
  $('#edu-venue').textContent = $('#side-venue').textContent = e.venue || 'Babington Academy';
  if(e.placesLeft !== null && e.placesLeft !== undefined && status === 'open'){
    $('#side-places').textContent = e.placesLeft > 0 ? `${e.placesLeft} places remaining` : 'Fully booked. New bookings join the waiting list.';
    $('#side-places').classList.remove('hidden');
  }

  $('#hero-cta').textContent = preview ? 'Preview the booking form' : copy.cta;
  $('#status-heading').textContent = copy.heading;
  $('#status-text').textContent = copy.text;
  if(e.bookingDeadline && status !== 'closed'){
    $('#status-deadline').textContent = `Please book by ${fmtDate(e.bookingDeadline)}.`;
    $('#status-deadline').classList.remove('hidden');
  }
  if(e.contactEmail){
    $('#status-contact').innerHTML = `Questions? Email <a href="mailto:${esc(e.contactEmail)}">${esc(e.contactEmail)}</a>.`;
    $('#status-contact').classList.remove('hidden');
  }

  renderFood();
  $('#dietary-field').classList.toggle('hidden', e.askDietary === false);
  $('#accessibility-field').classList.toggle('hidden', e.askAccessibility === false);
  if(e.privacyNoticeUrl){
    $('#privacy-text').insertAdjacentHTML('beforeend', ` <a href="${esc(e.privacyNoticeUrl)}" target="_blank" rel="noopener">Read our privacy notice</a>.`);
  }

  const showForm = preview || status === 'open';
  $('#booking-area').classList.toggle('hidden', !showForm);
  $('#booking-closed').classList.toggle('hidden', showForm);
  $('#booking-closed-text').textContent = copy.text;
  $('#booking-intro').textContent = showForm ? 'Fields marked optional can be left blank.' : '';
  if(preview){
    $('#preview-banner').classList.remove('hidden');
    $('#submit-button').textContent = 'Book my place (preview)';
  }
}

function showMessage(html, type='error'){
  $('#form-message').innerHTML = `<div class="notice ${type}" role="${type === 'error' ? 'alert' : 'status'}">${html}</div>`;
  if(type === 'error') $('#form-message').scrollIntoView({behavior:'smooth', block:'center'});
}

function validate(){
  form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  const problems = [];
  const flag = (el, text) => { el.setAttribute('aria-invalid','true'); problems.push({el, text}); };
  for(const [name, label] of [['firstName','your first name'],['lastName','your surname'],['organisation','your school or team']]){
    if(!form[name].value.trim()) flag(form[name], `Please enter ${label}.`);
  }
  const email = form.email.value.trim().toLowerCase();
  if(!email) flag(form.email, 'Please enter your Trust email address.');
  else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) flag(form.email, 'Please enter a valid email address.');
  else if(!email.endsWith(STAFF_DOMAIN)) flag(form.email, `Please use your ${STAFF_DOMAIN} email address.`);
  if(!$('#food-field').classList.contains('hidden') && !form.querySelector('[name=foodChoiceId]:checked')){
    flag(form.querySelector('[name=foodChoiceId]'), 'Please choose your food option.');
  }
  if(!form.consent.checked) flag(form.consent, 'Please confirm that you have read how your information will be used.');
  if(problems.length){
    showMessage(`<p><strong>Please check the following:</strong></p><ul>${problems.map(p => `<li>${esc(p.text)}</li>`).join('')}</ul>`);
    problems[0].el.focus({preventScroll:true});
    return false;
  }
  return true;
}

// Builds a calendar file for the confirmation screen.
function calendarLink(){
  const e = eduhub;
  if(!e.date) return '';
  const d = e.date.replaceAll('-','');
  const times = String(e.time||'').match(/(\d{1,2})[:.](\d{2}).*?(\d{1,2})[:.](\d{2})/);
  const pad = n => String(n).padStart(2,'0');
  const when = times
    ? `DTSTART;TZID=Europe/London:${d}T${pad(times[1])}${times[2]}00\r\nDTEND;TZID=Europe/London:${d}T${pad(times[3])}${times[4]}00`
    : `DTSTART;VALUE=DATE:${d}`;
  const text = s => String(s||'').replace(/[\\,;]/g, m => '\\'+m).replace(/\n/g,'\\n');
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LwLAT//Learning Hub//EN','BEGIN:VEVENT',
    `UID:eduhub-${d}@learninghub.lwlat.org.uk`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').slice(0,15)}Z`,
    when, `SUMMARY:${text(e.title)}`, `LOCATION:${text(e.venue)}`, 'END:VEVENT','END:VCALENDAR'].join('\r\n');
  return URL.createObjectURL(new Blob([ics], {type:'text/calendar'}));
}

function showConfirmation(data, body){
  const food = form.querySelector('[name=foodChoiceId]:checked')?.closest('.food-option')?.querySelector('.food-name')?.textContent;
  form.classList.add('hidden');
  const cal = calendarLink();
  $('#form-message').innerHTML = `<div class="form-shell confirmation" role="status" tabindex="-1">
    <div class="eyebrow teal">${data.waitingList ? 'Waiting list' : 'Booking confirmed'}</div>
    <h2>${data.waitingList ? 'You are on the waiting list' : 'Thank you, your place is booked'}</h2>
    ${data.waitingList ? '<p>EduHub 2027 is currently full. We will contact you if a place becomes available.</p>' : `<p>We look forward to seeing you at ${esc(eduhub.venue || 'Babington Academy')}.</p>`}
    <dl class="confirmation-list">
      ${data.reference ? `<div><dt>Booking reference</dt><dd><strong>${esc(data.reference)}</strong></dd></div>` : ''}
      <div><dt>Name</dt><dd>${esc(body.firstName)} ${esc(body.lastName)}</dd></div>
      <div><dt>Email</dt><dd>${esc(body.email)}</dd></div>
      <div><dt>Date</dt><dd>${fmtDate(eduhub.date)}${eduhub.time ? `, ${esc(eduhub.time)}` : ''}</dd></div>
      ${food ? `<div><dt>Food choice</dt><dd>${esc(food)}</dd></div>` : ''}
    </dl>
    <p class="muted">Please keep a note of your booking reference. If anything changes, contact the event organiser${eduhub.contactEmail ? ` at <a href="mailto:${esc(eduhub.contactEmail)}">${esc(eduhub.contactEmail)}</a>` : ''}.</p>
    <div class="hero-actions">
      ${cal && !data.waitingList ? `<a class="button" href="${cal}" download="EduHub-2027.ics">Add to my calendar</a>` : ''}
      <button class="button secondary" type="button" id="print-confirmation">Print this page</button>
    </div>
  </div>`;
  $('#print-confirmation').addEventListener('click', () => window.print());
  $('.confirmation').focus();
}

form.addEventListener('submit', async ev => {
  ev.preventDefault();
  $('#form-message').innerHTML = '';
  if(!validate()) return;
  if(preview){
    showMessage('<p><strong>Preview only.</strong> The form is complete and would be accepted. Nothing has been sent or saved.</p>', 'warn');
    return;
  }
  const button = $('#submit-button');
  button.disabled = true;
  button.textContent = 'Sending your booking';
  const body = Object.fromEntries(new FormData(form).entries());
  body.itemType = 'eduhub';
  body.itemId = 'eduhub-2027';
  body.consent = form.consent.checked;
  try{
    const res = await fetch('/api/book', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.error || 'Your booking could not be sent. Please try again.');
    showConfirmation(data, body);
  }catch(err){
    showMessage(`<p>${esc(err.message)}</p>`);
  }finally{
    button.disabled = false;
    button.textContent = 'Book my place';
  }
});

(async () => {
  try{
    const res = await fetch('/api/public-data', {cache:'no-store'});
    if(!res.ok) throw new Error();
    eduhub = (await res.json()).eduhub || {};
  }catch{
    eduhub = { effectiveStatus:'coming-soon' };
    $('#status-text').textContent = 'Event details are temporarily unavailable. Please try again shortly.';
  }
  render();
})();
