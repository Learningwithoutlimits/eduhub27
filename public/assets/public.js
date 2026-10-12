
const $ = (s, el=document) => el.querySelector(s);
const grid = $('#course-grid');
const modal = $('#booking-modal');
const eduhubModal = $('#eduhub-modal');
const form = $('#booking-form');
const searchInput = $('#course-search');
const courseCount = $('#course-count');
let state = { courses: [], eduhub: null };
let lastFocus = null;

const escapeHtml = str => String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmtDate = value => value ? new Intl.DateTimeFormat('en-GB',{dateStyle:'full'}).format(new Date(value+'T12:00:00')) : 'Date to be confirmed';

const sessionsFor = c => Array.isArray(c.sessions) && c.sessions.length
  ? c.sessions
  : [{label:'Session 1', date:c.date, time:c.time}];

const nextSessionDate = c => {
  const dated = sessionsFor(c)
    .map(s => s.date)
    .filter(Boolean)
    .sort();
  return dated[0] || '9999-12-31';
};

const scheduleHtml = c => {
  const sessions = sessionsFor(c);
  return `<div class="schedule-list">${sessions.map((s,i)=>`
    <div>
      <strong>${escapeHtml(s.label || `Session ${i+1}`)}</strong>
      <span>${fmtDate(s.date)}${s.time ? ` · ${escapeHtml(s.time)}` : ''}</span>
    </div>`).join('')}</div>`;
};

const cateringText = c => ({
  none:'No catering',
  refreshments:'Refreshments provided',
  lunch:'Lunch provided',
  other:c.cateringDetails || 'Catering details to be confirmed'
})[c.cateringType || 'none'];

const placesText = c => {
  if(c.placesLeft === null || c.placesLeft === undefined) return '';
  if(c.placesLeft === 0) return '<span><strong>Places:</strong> Fully booked. You can join the waiting list.</span>';
  return `<span><strong>Places:</strong> ${c.placesLeft} remaining</span>`;
};

async function load(){
  try{
    const res = await fetch('/api/public-data', {cache:'no-store'});
    if(!res.ok) throw new Error('Could not load');
    state = await res.json();
    renderCourses();
    renderEduhub();
  }catch(err){
    grid.innerHTML = '<div class="empty">Professional learning opportunities are temporarily unavailable. Please try again shortly.</div>';
  }
}

function filteredCourses(){
  const query = (searchInput?.value || '').trim().toLowerCase();
  return (state.courses || [])
    .filter(c => c.status === 'published')
    .filter(c => {
      if(!query) return true;
      const haystack = [
        c.title, c.summary, c.description, c.audience, c.facilitator, c.venue, c.category
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    })
    .sort((a,b) => nextSessionDate(a).localeCompare(nextSessionDate(b)) || String(a.title||'').localeCompare(String(b.title||'')));
}

function renderCourses(){
  const live = filteredCourses();
  if(courseCount){
    const total = (state.courses || []).filter(c => c.status === 'published').length;
    courseCount.textContent = `${live.length} of ${total} ${total === 1 ? 'opportunity' : 'opportunities'} shown`;
  }
  if(!live.length){
    const total = (state.courses || []).length;
    grid.innerHTML = `<div class="empty">${total ? 'No professional learning opportunities match your search.' : 'New professional learning opportunities will appear here soon.'}</div>`;
    return;
  }

  grid.innerHTML = live.map(c => {
    const full = c.placesLeft === 0;
    const label = !c.bookable ? 'Bookings closed' : full ? 'Join waiting list' : 'Book now';
    return `<article class="course-card text-only-card">
    <div class="course-body">
      <span class="tag">${escapeHtml(c.audience || 'Professional learning')}</span>
      <h3>${escapeHtml(c.title)}</h3>
      ${c.summary ? `<p>${escapeHtml(c.summary)}</p>` : ''}
      ${scheduleHtml(c)}
      <div class="meta">
        <span><strong>Venue:</strong> ${escapeHtml(c.venue || 'To be confirmed')}</span>
        ${c.facilitator ? `<span><strong>Facilitator:</strong> ${escapeHtml(c.facilitator)}</span>` : ''}
        ${c.cost ? `<span><strong>Cost:</strong> ${escapeHtml(c.cost)}</span>` : ''}
        <span><strong>Catering:</strong> ${escapeHtml(cateringText(c))}</span>
        ${c.bookingDeadline && c.bookable ? `<span><strong>Book by:</strong> ${fmtDate(c.bookingDeadline)}</span>` : ''}
        ${c.bookable ? placesText(c) : ''}
      </div>
      <div class="course-actions">
        <button class="button course-book" data-id="${escapeHtml(c.id)}" ${c.bookable ? '' : 'disabled'}>${label}</button>
        ${!c.bookable && c.closedReason ? `<p class="muted small">${escapeHtml(c.closedReason)}</p>` : ''}
      </div>
    </div>
  </article>`;}).join('');

  document.querySelectorAll('.course-book').forEach(b =>
    b.addEventListener('click', () => openBooking(b.dataset.id))
  );
}

const EDUHUB_LABELS = {
  'coming-soon': { button:'Bookings Open Soon', title:'Bookings Open Soon', text:'Bookings for EduHub 2027 have not opened yet. Please check back soon for further information.' },
  'closed': { button:'Bookings closed', title:'Bookings closed', text:'Bookings for EduHub 2027 are now closed. If you need to make a late change, please contact the event organiser.' },
  'open': { button:'Book your place' }
};

function renderEduhub(){
  const e = state.eduhub || {};
  const status = e.effectiveStatus || 'coming-soon';
  $('#eduhub-summary').innerHTML = `
    <span><strong>Date:</strong> ${fmtDate(e.date || '2027-01-05')}</span>
    ${e.time ? `<span><strong>Time:</strong> ${escapeHtml(e.time)}</span>` : ''}
    <span><strong>Venue:</strong> ${escapeHtml(e.venue || 'Babington Academy')}</span>`;
  const button = $('#eduhub-book');
  button.textContent = (EDUHUB_LABELS[status] || EDUHUB_LABELS['coming-soon']).button;
  button.dataset.status = status;
}

function openModal(el){
  lastFocus = document.activeElement;
  el.classList.add('open');
  el.setAttribute('aria-hidden','false');
  el.querySelector('input:not([type=hidden]):not([tabindex="-1"]), button')?.focus();
}
function closeModal(el){
  el.classList.remove('open');
  el.setAttribute('aria-hidden','true');
  lastFocus?.focus();
}

function openBooking(id){
  const item = state.courses.find(c => c.id === id);
  if(!item) return;
  form.reset();
  form.classList.remove('hidden');
  form.itemId.value = id;
  $('#booking-title').textContent = `Book: ${item.title}`;
  $('#booking-message').innerHTML = item.placesLeft === 0
    ? '<p class="notice warn">This opportunity is fully booked. Your request will be added to the waiting list.</p>' : '';
  $('#dietary-field').classList.toggle('hidden', !item.askDietary);
  openModal(modal);
}

$('#eduhub-book').addEventListener('click', () => {
  const status = $('#eduhub-book').dataset.status || 'coming-soon';
  if(status === 'open'){ location.href = '/eduhub/#booking'; return; }
  const copy = EDUHUB_LABELS[status] || EDUHUB_LABELS['coming-soon'];
  $('#eduhub-modal-title').textContent = copy.title;
  $('#eduhub-modal-text').textContent = copy.text;
  openModal(eduhubModal);
});
document.querySelectorAll('[data-eduhub-close]').forEach(b => b.addEventListener('click', () => closeModal(eduhubModal)));
eduhubModal.addEventListener('click', e => { if(e.target === eduhubModal) closeModal(eduhubModal); });

document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(modal)));
modal.addEventListener('click', e => { if(e.target === modal) closeModal(modal); });
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  if(modal.classList.contains('open')) closeModal(modal);
  if(eduhubModal.classList.contains('open')) closeModal(eduhubModal);
});

searchInput?.addEventListener('input', renderCourses);

form.addEventListener('submit', async e => {
  e.preventDefault();
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  button.textContent = 'Sending';
  $('#booking-message').innerHTML = '';
  const body = Object.fromEntries(new FormData(form).entries());

  try{
    const res = await fetch('/api/book', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.error || 'Your booking could not be sent. Please try again.');
    form.classList.add('hidden');
    $('#booking-message').innerHTML = `<div class="notice success-panel" role="status">
      <p><strong>Thank you. Your ${data.waitingList ? 'waiting-list request' : 'booking'} has been received.</strong></p>
      ${data.reference ? `<p>Your booking reference is <strong>${escapeHtml(data.reference)}</strong>. Please keep a note of it.</p>` : ''}
      ${data.waitingList ? '<p>We will contact you if a place becomes available.</p>' : ''}
      ${data.ticketUrl ? `<p>${data.emailSent ? 'We have emailed you a confirmation with your ticket. ' : ''}<a href="${escapeHtml(data.ticketUrl)}">Open your ticket</a> to see the QR code to bring on the day.</p>` : ''}
    </div>`;
    load();
  }catch(err){
    $('#booking-message').innerHTML = `<p class="notice error" role="alert">${escapeHtml(err.message)}</p>`;
  }finally{
    button.disabled = false;
    button.textContent = 'Submit booking';
  }
});

load();
