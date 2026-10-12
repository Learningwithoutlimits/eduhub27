
const $ = s => document.querySelector(s);
const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[c]));
const fmtDate = value => value
  ? new Intl.DateTimeFormat('en-GB',{dateStyle:'full'}).format(new Date(value+'T12:00:00'))
  : 'Date to be confirmed';

async function api(path){
  const res = await fetch('/api/'+path,{cache:'no-store'});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Unable to load preview');
  return data;
}

function sessionsFor(c){
  return Array.isArray(c.sessions) && c.sessions.length
    ? c.sessions
    : [{label:'Session 1',date:c.date,time:c.time}];
}

function cateringText(c){
  return ({
    none:'No catering',
    refreshments:'Refreshments provided',
    lunch:'Lunch provided',
    other:c.cateringDetails || 'Catering details to be confirmed'
  })[c.cateringType || 'none'];
}

function renderCourse(c){
  $('#preview-eyebrow').textContent = 'Professional Learning';
  $('#preview-title').textContent = c.title || 'Untitled opportunity';
  $('#preview-summary').textContent = c.summary || '';

  const sessions = sessionsFor(c);
  $('#preview-content').innerHTML = `
    <div class="preview-detail-grid">
      <article>
        ${c.description ? `<h2>About this opportunity</h2><p>${esc(c.description)}</p>` : ''}
        ${c.audience ? `<h2>Who is it for?</h2><p>${esc(c.audience)}</p>` : ''}
        ${c.facilitator ? `<h2>Facilitator</h2><p>${esc(c.facilitator)}</p>` : ''}
      </article>
      <aside class="preview-info-card">
        <h2>Course details</h2>
        <div class="schedule-list">
          ${sessions.map((s,i)=>`
            <div>
              <strong>${esc(s.label || `Session ${i+1}`)}</strong>
              <span>${fmtDate(s.date)}${s.time ? ` · ${esc(s.time)}` : ''}</span>
            </div>`).join('')}
        </div>
        <div class="meta">
          <span><strong>Venue:</strong> ${esc(c.venue || 'To be confirmed')}</span>
          ${c.cost ? `<span><strong>Cost:</strong> ${esc(c.cost)}</span>` : ''}
          ${c.capacity ? `<span><strong>Capacity:</strong> ${esc(c.capacity)} places</span>` : ''}
          <span><strong>Catering:</strong> ${esc(cateringText(c))}</span>
          ${c.bookingDeadline ? `<span><strong>Booking deadline:</strong> ${fmtDate(c.bookingDeadline)}</span>` : ''}
        </div>
        <button class="button" type="button" disabled>Preview only</button>
        ${c.status !== 'published' ? `<p class="notice warn">This opportunity is ${esc(c.status || 'draft')}, so it is not shown on the public site.</p>` : ''}
        <p class="muted preview-note">Bookings cannot be submitted from preview mode.</p>
      </aside>
    </div>`;
}

(async()=>{
  const params = new URLSearchParams(location.search);
  const type = params.get('type') || 'course';
  const id = params.get('id');

  // The EduHub preview lives on the real EduHub page.
  if(type === 'eduhub'){ location.replace('/eduhub/?preview=1'); return; }

  try{
    const data = await api('admin-data');

    const course = (data.courses || []).find(c => c.id === id);
    if(!course) throw new Error('That opportunity could not be found.');
    renderCourse(course);
  }catch(err){
    $('#preview-title').textContent = 'Preview unavailable';
    $('#preview-content').innerHTML = `<p class="notice error">${esc(err.message)}</p>`;
  }
})();

document.getElementById('close-preview')?.addEventListener('click', () => window.close());
