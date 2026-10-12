
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
        <p class="muted preview-note">Bookings cannot be submitted from preview mode.</p>
      </aside>
    </div>`;
}

function renderEduhub(e){
  $('#preview-eyebrow').textContent = 'EduHub 2027 · LwLAT staff only';
  $('#preview-title').textContent = e.title || 'EduHub 2027: Better Together';
  $('#preview-summary').textContent = e.description || '';

  const food = Array.isArray(e.foodChoices) ? e.foodChoices : [];

  $('#preview-content').innerHTML = `
    <div class="preview-eduhub-layout">
      <section class="preview-eduhub-details">
        <span class="tag internal">LwLAT staff only</span>
        <h2>Event details</h2>
        <div class="meta preview-meta-stack">
          <span><strong>Date:</strong> ${fmtDate(e.date || '2027-01-05')}</span>
          ${e.time ? `<span><strong>Time:</strong> ${esc(e.time)}</span>` : ''}
          <span><strong>Venue:</strong> ${esc(e.venue || 'Babington Academy')}</span>
          ${e.capacity ? `<span><strong>Capacity:</strong> ${esc(e.capacity)} places</span>` : ''}
        </div>

        ${food.length ? `
          <h2>Food choices</h2>
          <ul class="preview-food-list">
            ${food.map(choice=>`<li>${esc(choice)}</li>`).join('')}
          </ul>
          <p><a href="/documents/EduHub-2027-Allergen-Matrix.pdf" target="_blank" rel="noopener"><strong>View the EduHub 2027 Food Allergen Matrix (PDF)</strong></a></p>` : '<p class="muted">No food choices have been added yet.</p>'}
      </section>

      <aside class="preview-booking-card">
        <div class="preview-only-badge">Admin preview only</div>
        <h2>Book your place</h2>
        <p class="notice warn">This is how the EduHub booking form will look when bookings open. Nothing entered here will be submitted.</p>

        <form class="form-grid preview-form">
          <div class="field">
            <label>First name</label>
            <input value="Alex" disabled>
          </div>
          <div class="field">
            <label>Surname</label>
            <input value="Taylor" disabled>
          </div>
          <div class="field full">
            <label>Trust email address</label>
            <input value="alex.taylor@lwlat.org.uk" disabled>
          </div>
          <div class="field">
            <label>School or organisation</label>
            <input value="Learning Without Limits Academy Trust" disabled>
          </div>
          <div class="field">
            <label>Job title</label>
            <input value="Member of staff" disabled>
          </div>
          <div class="field">
            <label>Telephone</label>
            <input value="0116 000 0000" disabled>
          </div>

          ${food.length ? `
          <div class="field full">
            <label>Food choice</label>
            <select disabled>
              <option>Please choose</option>
              ${food.map(choice=>`<option>${esc(choice)}</option>`).join('')}
            </select>
          </div>` : ''}

          ${e.askDietary ? `
          <div class="field full">
            <label>Dietary requirements</label>
            <input placeholder="Please tell us about any dietary requirements" disabled>
          </div>` : ''}

          <div class="field full">
            <label>Accessibility requirements</label>
            <input placeholder="Please tell us about any accessibility requirements" disabled>
          </div>

          <div class="field full">
            <label>Additional notes</label>
            <textarea disabled></textarea>
          </div>

          <div class="field full">
            <button class="button" type="button" disabled>Submit booking</button>
            <p class="muted preview-note">Submission is disabled in preview mode.</p>
          </div>
        </form>
      </aside>
    </div>`;
}

(async()=>{
  const params = new URLSearchParams(location.search);
  const type = params.get('type') || 'course';
  const id = params.get('id');

  try{
    const data = await api('admin-data');

    if(type === 'eduhub'){
      renderEduhub(data.eduhub || {});
      return;
    }

    const course = (data.courses || []).find(c => c.id === id);
    if(!course) throw new Error('That opportunity could not be found.');
    renderCourse(course);
  }catch(err){
    $('#preview-title').textContent = 'Preview unavailable';
    $('#preview-content').innerHTML = `<p class="notice error">${esc(err.message)}</p>`;
  }
})();
