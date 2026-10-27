import './logo-trim.js';
import { foodOptionsHtml } from './food-options.js';

const $ = s => document.querySelector(s);
const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmtDate = v => v ? new Intl.DateTimeFormat('en-GB',{dateStyle:'full'}).format(new Date(v+'T12:00:00')) : '';
const code = new URLSearchParams(location.search).get('code') || '';
const form = $('#speaker-form');
let eduhub = {};

function closed(text){
  $('#sp-closed').innerHTML = `<p>${text}</p>${eduhub.contactEmail ? `<p>Please contact <a href="mailto:${esc(eduhub.contactEmail)}">${esc(eduhub.contactEmail)}</a>.</p>` : ''}`;
  $('#sp-closed').classList.remove('hidden');
}

function showMessage(html, type='error'){
  $('#sp-message').innerHTML = `<div class="notice ${type}" role="${type === 'error' ? 'alert' : 'status'}">${html}</div>`;
  $('#sp-message').scrollIntoView({behavior:'smooth', block:'center'});
}

function validate(){
  form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  const problems = [];
  const flag = (el, text) => { el.setAttribute('aria-invalid','true'); problems.push({el, text}); };
  if(!form.firstName.value.trim()) flag(form.firstName, 'Please enter your first name.');
  if(!form.lastName.value.trim()) flag(form.lastName, 'Please enter your surname.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())) flag(form.email, 'Please enter a valid email address.');
  if(!form.leading.value) flag(form.leading, 'Please choose the session you are leading.');
  if(!$('#food-field').classList.contains('hidden') && !form.querySelector('[name=foodChoiceId]:checked')) flag(form.querySelector('[name=foodChoiceId]'), 'Please choose your lunch.');
  if(!form.consent.checked) flag(form.consent, 'Please confirm that you have read how your information will be used.');
  if(problems.length){
    showMessage(`<p><strong>Please check the following:</strong></p><ul>${problems.map(p => `<li>${esc(p.text)}</li>`).join('')}</ul>`);
    problems[0].el.focus({preventScroll:true});
    return false;
  }
  return true;
}

form.addEventListener('submit', async ev => {
  ev.preventDefault();
  $('#sp-message').innerHTML = '';
  if(!validate()) return;
  const button = $('#submit-button');
  button.disabled = true; button.textContent = 'Sending';
  const body = Object.fromEntries(new FormData(form).entries());
  Object.assign(body, { itemType:'eduhub-speaker', itemId:'eduhub-2027', code, consent: form.consent.checked });
  try{
    const res = await fetch('/api/book', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.error || 'Your booking could not be sent. Please try again.');
    const food = form.querySelector('[name=foodChoiceId]:checked')?.closest('.food-option')?.querySelector('.food-name')?.textContent;
    form.classList.add('hidden');
    $('#sp-message').innerHTML = `<div class="form-shell confirmation" role="status" tabindex="-1">
      <div class="eyebrow teal">Lunch booked</div>
      <h2>Thank you, ${esc(body.firstName)}</h2>
      <p>We look forward to welcoming you to ${esc(eduhub.venue || 'Babington Academy')}.</p>
      <dl class="confirmation-list">
        <div><dt>Booking reference</dt><dd><strong>${esc(data.reference)}</strong></dd></div>
        <div><dt>Date</dt><dd>${esc(fmtDate(eduhub.date))}</dd></div>
        <div><dt>Leading</dt><dd>${esc(body.leading)}</dd></div>
        ${food ? `<div><dt>Lunch</dt><dd>${esc(food)}</dd></div>` : ''}
      </dl>
      ${data.ticketUrl ? `<div class="ticket-inline"><h3>Your ticket</h3>
        <img class="ticket-qr" src="/api/qr?${esc(data.ticketUrl.split('?')[1] || '')}" width="200" height="200" alt="QR code for your booking">
        <p>${data.emailSent ? `We have also emailed this to <strong>${esc(body.email)}</strong>. ` : ''}Please show it when you arrive.</p>
        <p><a href="${esc(data.ticketUrl)}">Open your ticket</a></p></div>` : ''}
    </div>`;
    $('.confirmation').focus();
  }catch(err){
    showMessage(`<p>${esc(err.message)}</p>`);
  }finally{
    button.disabled = false; button.textContent = 'Book my lunch';
  }
});

(async () => {
  try{
    const [access, pub] = await Promise.all([
      fetch(`/api/speaker-access?code=${encodeURIComponent(code)}`, {cache:'no-store'}).then(r => r.json()),
      fetch('/api/public-data', {cache:'no-store'}).then(r => r.json())
    ]);
    eduhub = pub.eduhub || {};
    $('#sp-title').textContent = eduhub.title || 'EduHub 2027';
    $('#sp-date').textContent = fmtDate(eduhub.date) || 'Tuesday 5 January 2027';
    $('#sp-venue').textContent = eduhub.venue || 'Babington Academy';
    if(!access.valid) return closed('This booking link is not valid. Please check you have used the full link from your invitation email.');
    if(!access.open) return closed('Speaker lunch bookings are not open at the moment.');
    const k = eduhub.keynote || {};
    const options = [k.name ? `Keynote: ${k.name}` : '', ...(eduhub.workshops || []).map(w => w.speakerName ? `${w.title} (${w.speakerName})` : w.title), 'Other'].filter(Boolean);
    form.leading.innerHTML = '<option value="">Please choose</option>' + options.map(o => `<option>${esc(o)}</option>`).join('');
    const food = foodOptionsHtml(eduhub);
    $('#food-field').classList.toggle('hidden', !food);
    $('#food-options').innerHTML = food;
    $('#dietary-field').classList.toggle('hidden', eduhub.askDietary === false);
    $('#accessibility-field').classList.toggle('hidden', eduhub.askAccessibility === false);
    form.classList.remove('hidden');
  }catch{
    closed('This page could not be loaded. Please try again shortly.');
  }
})();
