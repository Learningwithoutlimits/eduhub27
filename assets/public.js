
const $ = (s, el=document) => el.querySelector(s);
const grid = $('#course-grid');
const modal = $('#booking-modal');
const eduhubModal = $('#eduhub-modal');
const form = $('#booking-form');
const searchInput = $('#course-search');
const courseCount = $('#course-count');
let state = { courses: [], eduhub: null };

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
    grid.innerHTML = '<div class="empty">No professional learning opportunities match your search.</div>';
    return;
  }

  grid.innerHTML = live.map(c => `<article class="course-card text-only-card">
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
      </div>
      <div class="course-actions">
        <button class="button course-book" data-id="${c.id}" ${c.bookingOpen === false ? 'disabled' : ''}>
          ${c.bookingOpen === false ? 'Bookings closed' : 'Book now'}
        </button>
      </div>
    </div>
  </article>`).join('');

  document.querySelectorAll('.course-book').forEach(b =>
    b.addEventListener('click', () => openBooking('course', b.dataset.id))
  );
}

function renderEduhub(){
  const e = state.eduhub || {};
  $('#eduhub-summary').innerHTML = `
    <span><strong>Date:</strong> ${fmtDate(e.date || '2027-01-05')}</span>
    <span><strong>Venue:</strong> ${escapeHtml(e.venue || 'Babington Academy')}</span>`;
  const button = $('#eduhub-book');
  button.disabled = false;
  button.textContent = 'Bookings Open Soon';
}

function openBooking(type,id){
  const item = state.courses.find(c => c.id === id);
  form.reset();
  form.itemId.value = id;
  form.itemType.value = type;
  $('#booking-title').textContent = `Book: ${item?.title || ''}`;
  $('#booking-message').innerHTML = '';
  const askDietary = Boolean(item?.askDietary);
  $('#dietary-field').classList.toggle('hidden', !askDietary);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
}

function closeBooking(){
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
}

function openEduhubNotice(){
  eduhubModal.classList.add('open');
  eduhubModal.setAttribute('aria-hidden','false');
}

function closeEduhubNotice(){
  eduhubModal.classList.remove('open');
  eduhubModal.setAttribute('aria-hidden','true');
}

$('#eduhub-book').addEventListener('click', openEduhubNotice);
document.querySelectorAll('[data-eduhub-close]').forEach(b => b.addEventListener('click', closeEduhubNotice));
eduhubModal.addEventListener('click', e => { if(e.target === eduhubModal) closeEduhubNotice(); });

document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeBooking));
modal.addEventListener('click', e => { if(e.target === modal) closeBooking(); });

searchInput?.addEventListener('input', renderCourses);

form.addEventListener('submit', async e => {
  e.preventDefault();
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  button.textContent = 'Submitting…';
  $('#booking-message').innerHTML = '';
  const body = Object.fromEntries(new FormData(form).entries());

  try{
    const res = await fetch('/api/book', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body)
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Booking failed');
    form.classList.add('hidden');
    $('#booking-message').innerHTML = `<p class="notice">Thank you. Your ${data.waitingList ? 'waiting-list request' : 'booking'} has been received.</p>`;
  }catch(err){
    $('#booking-message').innerHTML = `<p class="notice error">${escapeHtml(err.message)}</p>`;
  }finally{
    button.disabled = false;
    button.textContent = 'Submit booking';
  }
});

modal.addEventListener('transitionend', () => {
  if(!modal.classList.contains('open')) form.classList.remove('hidden');
});

load();
