import { foodOptionsHtml } from './food-options.js';
import { celebrate } from './celebrate.js';

const $ = s => document.querySelector(s);
const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmtDate = value => value
  ? new Intl.DateTimeFormat('en-GB',{dateStyle:'full'}).format(new Date(value+'T12:00:00'))
  : 'Date to be confirmed';

const staffDomains = () => (eduhub.staffDomains && eduhub.staffDomains.length ? eduhub.staffDomains : ['lwlat.org.uk']).map(d => '@' + d);
const domainText = () => { const d = staffDomains(); return d.length > 1 ? `${d.slice(0,-1).join(', ')} or ${d.at(-1)}` : d[0]; };
const NO_FOOD = 'no-food';
// ?preview=1 shows the finished form whatever the booking status, but never sends anything.
const preview = new URLSearchParams(location.search).get('preview') === '1';
const form = $('#eduhub-form');
let eduhub = {};

const PHASE_NAMES = { primary:'Primary', secondary:'Secondary', central:'Central Trust' };
const AUDIENCES = { all:'Open to all', educators:'All educators', leaders:'Anyone who leads a team' };
const times = x => x.startTime ? `${x.startTime}${x.endTime ? ` to ${x.endTime}` : ''}` : '';
const slotLabel = x => x.roundLabel ? (times(x) ? `${x.roundLabel}, ${times(x)}` : x.roundLabel) : (times(x) || 'Time to be confirmed');
function slotsOf(sessions){
  const slots = [];
  for(const x of sessions){
    const key = x.roundId || `${x.startTime}-${x.endTime}`;
    let slot = slots.find(s => s.key === key);
    if(!slot) slots.push(slot = { key, label: slotLabel(x), items: [] });
    slot.items.push(x);
  }
  return slots;
}
const photoSrc = x => x.photoId ? `/api/photo?id=${encodeURIComponent(x.photoId)}` : (x.photoPath || '');
const photoHtml = (x, name = x.speakerName) => photoSrc(x)
  ? `<img class="speaker-img" src="${esc(photoSrc(x))}" alt="${esc(name ? `Photo of ${name}` : '')}" loading="lazy">`
  : '';
const sessionMeta = x => [x.speakerName ? `<span><strong>${esc(x.speakerName)}</strong>${x.speakerRole ? `, ${esc(x.speakerRole)}` : ''}</span>` : '', x.room ? `<span>Room: ${esc(x.room)}</span>` : ''].filter(Boolean).join('');
// Turns plain text into paragraphs, with lines starting "- " as bullet points.
function textHtml(text){
  const out = []; let list = null;
  for(const line of String(text || '').split('\n').map(l => l.trim()).filter(Boolean)){
    if(line.startsWith('- ')){ if(!list){ list = []; out.push(list); } list.push(line.slice(2)); }
    else { list = null; out.push(line); }
  }
  return out.map(x => Array.isArray(x) ? `<ul>${x.map(li => `<li>${esc(li)}</li>`).join('')}</ul>` : `<p>${esc(x)}</p>`).join('');
}
const audienceTag = x => x.recommended ? `<span class="tag">Recommended for: ${esc((AUDIENCES[x.recommended] || '').toLowerCase())}</span>` : '';

const STATUS_COPY = {
  'coming-soon': { cta:'Bookings Open Soon', heading:'Bookings open soon', text:'Bookings for EduHub 2027 have not opened yet. Please check back soon.' },
  'open': { cta:'Book your place', heading:'Bookings are open', text:'Book your place using the form below. It only takes a few minutes.' },
  'closed': { cta:'Bookings closed', heading:'Bookings are closed', text:'Bookings for EduHub 2027 are now closed. If you need to make a late change, please contact the event organiser.' }
};

function renderFood(){
  const html = foodOptionsHtml(eduhub);
  $('#food-field').classList.toggle('hidden', !html);
  $('#food-options').innerHTML = html;
}

const currentRole = () => form.querySelector('[name=role]:checked')?.value || 'staff';
function currentPhase(){
  if(currentRole() === 'trustee') return 'central';
  const schools = eduhub.schools || [];
  if(!schools.length) return '';
  return schools.find(x => x.id === form.schoolId.value)?.phase || null;
}
const openTo = (x, phase) => !phase || !(x.roundPhases || []).length || x.roundPhases.includes(phase);

// ---------- Workshop choices, one round at a time ----------
// choices: round id -> chosen session id ('' means "no workshop" when optional).
const choices = {};
let editingRound = null;
let lastSlots = [];

function choiceTile(x, takenIn){
  const full = x.placesLeft === 0;
  const blocked = full || Boolean(takenIn);
  return `<label class="choice-tile${blocked ? ' is-blocked' : ''}${x.warning ? ' has-warning' : ''}">
    <input type="radio" name="round-choice" value="${esc(x.id)}" data-round="${esc(x.roundId || '')}" ${blocked ? 'disabled' : ''} ${choices[x.roundId] === x.id ? 'checked' : ''}>
    <span class="choice-tile-photo">${photoHtml(x)}</span>
    <span class="choice-tile-body">
      <span class="choice-tile-title">${esc(x.title)}</span>
      ${x.speakerName ? `<span class="choice-tile-speaker">${esc(x.speakerName)}</span>` : ''}
      ${audienceTag(x)}
      ${x.warning ? `<span class="choice-warning"><span aria-hidden="true">&#9888;</span> ${esc(x.warning)}</span>` : ''}
      ${full ? '<span class="status-pill waiting">Full in this round</span>' : takenIn ? `<span class="taken-note">Already chosen for ${esc(takenIn)}</span>` : x.placesLeft ? `<span class="places-left">${x.placesLeft} ${x.placesLeft === 1 ? 'place' : 'places'} left</span>` : ''}
      ${x.workshopId ? `<a href="#" class="info-link" data-open-workshop="${esc(x.workshopId)}">More about this workshop</a>` : ''}
    </span>
  </label>`;
}

function renderSessionChoices(focusStep){
  const sessions = eduhub.sessions || [];
  const field = $('#sessions-field');
  field.classList.toggle('hidden', !sessions.length);
  if(!sessions.length) return;
  const phase = currentPhase();
  if(phase === null){
    lastSlots = [];
    $('#sessions-help').textContent = '';
    $('#session-options').innerHTML = '<p class="notice">Choose your school or team above to see your workshop times and choices.</p>';
    return;
  }
  const eligible = sessions.filter(x => openTo(x, phase));
  const slots = slotsOf(eligible);
  lastSlots = slots;
  // Forget choices that no longer apply, for example after changing school.
  for(const key of Object.keys(choices)){
    const slot = slots.find(sl => sl.key === key);
    if(!slot || (choices[key] && !slot.items.some(x => x.id === choices[key]))) delete choices[key];
  }
  const who = currentRole() === 'trustee' ? 'Trustees join the central Trust staff, who attend' : currentRole() === 'governor' ? `Governors of ${PHASE_NAMES[phase]?.toLowerCase()} schools join ${PHASE_NAMES[phase]?.toLowerCase()} staff, who attend` : `${PHASE_NAMES[phase]} staff attend`;
  $('#sessions-help').textContent = `${phase ? `${who} ${slots.length === 1 ? 'one workshop round' : `${slots.length} workshop rounds`}. ` : ''}Choose your workshop for each round in turn. You cannot choose the same workshop twice.`;
  if(!eligible.length){ $('#session-options').innerHTML = '<p class="muted">There are no workshops to choose from for your school yet.</p>'; return; }
  const active = editingRound && slots.some(sl => sl.key === editingRound) ? editingRound : slots.find(sl => !(sl.key in choices))?.key;
  const titleOf = id => (eduhub.sessions || []).find(x => x.id === id);
  const labelOfRound = key => slots.find(sl => sl.key === key)?.items[0]?.roundLabel || 'another round';
  $('#session-options').innerHTML = `<ol class="round-steps">${slots.map((slot, i) => {
    const step = `Step ${i + 1} of ${slots.length}`;
    if(slot.key === active){
      const takenBy = {};
      for(const [key, id] of Object.entries(choices)) if(key !== slot.key && id) takenBy[titleOf(id)?.workshopId] = labelOfRound(key);
      return `<li class="round-step is-active"><fieldset>
        <legend id="step-${i}" tabindex="-1"><span class="step-count">${step}</span> Choose your workshop for <strong>${esc(slot.label)}</strong></legend>
        <div class="choice-grid">
          ${slot.items.map(x => choiceTile(x, takenBy[x.workshopId])).join('')}
          ${eduhub.requireSessionChoice ? '' : `<label class="choice-tile choice-none"><input type="radio" name="round-choice" value="" data-round="${esc(slot.key)}" ${choices[slot.key] === '' ? 'checked' : ''}><span class="choice-tile-body"><span class="choice-tile-title">No workshop in this round</span></span></label>`}
        </div>
      </fieldset></li>`;
    }
    if(slot.key in choices){
      const chosen = titleOf(choices[slot.key]);
      return `<li class="round-step is-done" id="step-${i}" tabindex="-1">
        <span class="step-tick" aria-hidden="true">&#10003;</span>
        <span class="step-summary"><span class="step-count">${esc(slot.label)}</span>
          <strong>${chosen ? esc(chosen.title) : 'No workshop'}</strong>${chosen?.speakerName ? ` <span class="muted">with ${esc(chosen.speakerName)}</span>` : ''}</span>
        <button type="button" class="button secondary small-button" data-change-round="${esc(slot.key)}">Change<span class="visually-hidden"> ${esc(slot.label)}</span></button>
      </li>`;
    }
    return `<li class="round-step is-pending"><span class="step-count">${step}</span> ${esc(slot.label)}<span class="muted">Choose after ${esc(slots[i - 1]?.label || 'the step above')}</span></li>`;
  }).join('')}</ol>
  ${!active ? '<p class="notice all-chosen">All your workshops are chosen. You can change any of them above.</p>' : ''}`;
  if(focusStep !== undefined){
    const target = $(`#step-${focusStep}`) || $('.all-chosen');
    target?.scrollIntoView({behavior:'smooth', block:'center'});
    target?.focus({preventScroll:true});
  }
}
$('#session-options').addEventListener('change', e => {
  if(e.target.name !== 'round-choice') return;
  choices[e.target.dataset.round] = e.target.value;
  editingRound = null;
  const next = lastSlots.findIndex(sl => !(sl.key in choices));
  renderSessionChoices(next === -1 ? lastSlots.length : next);
  renderYourDay();
});
$('#session-options').addEventListener('click', e => {
  const tile = e.target.closest('.choice-tile');
  if(tile && !e.target.closest('[data-open-workshop]') && editingRound){
    const input = tile.querySelector('input');
    if(input?.checked && choices[input.dataset.round] === input.value){
      editingRound = null;
      const next = lastSlots.findIndex(sl => !(sl.key in choices));
      setTimeout(() => renderSessionChoices(next === -1 ? lastSlots.length : next));
      return;
    }
  }
  const btn = e.target.closest('[data-change-round]'); if(!btn) return;
  editingRound = btn.dataset.changeRound;
  renderSessionChoices(lastSlots.findIndex(sl => sl.key === editingRound));
});

// ---------- Structure of the day ----------
const KIND_LABEL = { arrival:'Arrival', keynote:'Keynote', workshop:'Workshop', break:'Break', lunch:'Lunch', awards:'Awards', general:'' };
let dayPhase = '';
const agendaFor = phase => (eduhub.agenda || []).filter(a => !phase || !(a.groups || []).length || a.groups.includes(phase));
const chosenFor = roundId => choices[roundId] ? (eduhub.sessions || []).find(x => x.id === choices[roundId]) : null;
function timelineHtml(items, personal){
  return items.map(a => {
    const chosen = personal && a.roundId ? chosenFor(a.roundId) : null;
    const round = a.roundId ? (eduhub.rounds || []).find(r => r.id === a.roundId) : null;
    const title = chosen ? chosen.title : a.kind === 'workshop' && round ? `${a.title}: ${round.label}` : a.title;
    const where = chosen?.room || a.location;
    return `<li class="timeline-item kind-${esc(a.kind)}${chosen ? ' is-chosen' : ''}">
      <span class="timeline-time">${esc(a.startTime)}${a.endTime && !personal ? `<span> to ${esc(a.endTime)}</span>` : ''}</span>
      <span class="timeline-dot" aria-hidden="true"></span>
      <div class="timeline-body">
        ${KIND_LABEL[a.kind] && !chosen ? `<span class="timeline-kind">${KIND_LABEL[a.kind]}</span>` : ''}
        ${chosen ? '<span class="timeline-kind">Your workshop</span>' : ''}
        <strong>${esc(title)}</strong>
        ${where ? `<span class="timeline-where">${esc(where)}</span>` : ''}
        ${a.detail && !personal ? `<span class="timeline-detail">${esc(a.detail)}</span>` : ''}
        ${personal && a.kind === 'workshop' && !chosen ? '<span class="timeline-detail">Choose your workshop below</span>' : ''}
        ${a.kind === 'awards' && !personal && eduhub.recognitionUrl ? '<button type="button" class="link-button" data-open-awards>&#9733; Nominate a colleague</button>' : ''}
      </div>
    </li>`;
  }).join('');
}
// ---------- "Who are you?" ----------
const WHO = [
  { key:'primary', label:'Primary school staff', phase:'primary', role:'staff' },
  { key:'secondary', label:'Secondary school staff', phase:'secondary', role:'staff' },
  { key:'central', label:'Central Trust staff', phase:'central', role:'staff' },
  { key:'gov-primary', label:'Governor of a primary school', phase:'primary', role:'governor' },
  { key:'gov-secondary', label:'Governor of a secondary school', phase:'secondary', role:'governor' },
  { key:'trustee', label:'Trustee', phase:'central', role:'trustee' }
];
let who = null;
try{ who = WHO.find(w => w.key === localStorage.getItem('eduhub-who')) || null; }catch{}
let whoAsked = false;
const whoOptions = () => WHO.filter(w => (w.role === 'staff' || eduhub.allowGovernors !== false) && (eduhub.agenda || []).some(a => !(a.groups || []).length || a.groups.includes(w.phase)));

function openWho(){
  $('#who-options').innerHTML = whoOptions().map(w => `<button type="button" class="who-option who-${esc(w.role)}" data-who="${esc(w.key)}" aria-pressed="${who?.key === w.key}">
      <span class="who-icon" aria-hidden="true">${w.role === 'trustee' ? 'T' : w.role === 'governor' ? 'G' : w.phase[0].toUpperCase()}</span>
      <span class="who-label">${esc(w.label)}</span>
    </button>`).join('');
  openModal($('#who-dialog'));
  ($('#who-options [aria-pressed="true"]') || $('#who-options button'))?.focus();
}
function chooseWho(key){
  who = WHO.find(w => w.key === key) || null;
  try{ localStorage.setItem('eduhub-who', key); }catch{}
  $('#who-dialog').close();
  if(!who) return;
  dayPhase = who.phase;
  // Carry the choice into the booking form.
  const radio = form.querySelector(`[name=role][value="${who.role}"]`);
  if(radio && !radio.checked && !$('#role-field').classList.contains('hidden')){ radio.checked = true; applyRole(); }
  renderDay();
  $('#day').scrollIntoView({ behavior:'smooth', block:'start' });
}
$('#who-options').addEventListener('click', e => { const b = e.target.closest('[data-who]'); if(b) chooseWho(b.dataset.who); });

function renderDay(){
  const agenda = eduhub.agenda || [];
  $('#day').classList.toggle('hidden', !agenda.length);
  if(!agenda.length) return;
  const grouped = agenda.some(a => (a.groups || []).length);
  if(!grouped){
    $('#day-who').innerHTML = '';
    $('#day-timeline').innerHTML = timelineHtml(agendaFor(''), false);
    return;
  }
  if(who) dayPhase = who.phase;
  $('#day-who').innerHTML = who
    ? `<div class="who-chip"><span>Showing the day for</span><strong>${esc(who.label)}</strong><button type="button" class="button secondary small-button" data-open-who>Change</button></div>`
    : '';
  $('#day-timeline').innerHTML = who
    ? timelineHtml(agendaFor(dayPhase), false)
    : `<li class="who-prompt"><p><strong>Your day depends on who you are.</strong> Primary, secondary and central staff, governors and trustees each have a slightly different timetable.</p><button type="button" class="button" data-open-who>Show me my day</button></li>`;
  if(!who && !whoAsked){ whoAsked = true; setTimeout(openWho, 400); }
}
document.addEventListener('click', e => { if(e.target.closest('[data-open-who]')) openWho(); });

// ---------- Recognition awards lightbox ----------
let stopCelebration = () => {};
function openAwards(){
  if(!eduhub.recognitionUrl) return;
  const awards = (eduhub.agenda || []).find(a => a.kind === 'awards');
  $('#awards-when').textContent = awards ? `${awards.title}${awards.startTime ? `, ${awards.startTime}${awards.endTime ? ` to ${awards.endTime}` : ''}` : ''}${awards.location ? `, ${awards.location}` : ''}` : 'LwLAT Better Together Recognition Awards 2027';
  $('#awards-link').href = eduhub.recognitionUrl;
  openModal($('#awards-dialog'));
  stopCelebration();
  requestAnimationFrame(() => { stopCelebration = celebrate($('#celebrate-canvas'), { sparklers: [{ x: 0.12, y: 0.42 }, { x: 0.88, y: 0.42 }] }); });
}
$('#awards-dialog').addEventListener('close', () => stopCelebration());
document.addEventListener('click', e => { if(e.target.closest('[data-open-awards]')){ e.preventDefault(); openAwards(); } });

function renderYourDay(){
  const phase = currentPhase();
  const agenda = eduhub.agenda || [];
  const show = agenda.length && phase !== null;
  $('#your-day').classList.toggle('hidden', !show);
  if(show) $('#your-day-timeline').innerHTML = timelineHtml(agendaFor(phase), true);
}

// ---------- Keynote and workshops ----------
function renderProgramme(){
  const workshops = eduhub.workshops || [];
  const k = eduhub.keynote || {};
  $('#programme').classList.toggle('hidden', !workshops.length && !k.name);
  $('#keynote-feature').innerHTML = k.name ? `<article class="keynote-feature">
      ${photoSrc(k) ? `<img src="${esc(photoSrc(k))}" alt="Photo of ${esc(k.name)}">` : ''}
      <div>
        <div class="eyebrow">Keynote speaker${times(k) ? `, ${esc(times(k))}` : ''}</div>
        <h2>${esc(k.title || k.name)}</h2>
        ${k.title ? `<p class="keynote-name">${esc(k.name)}</p>` : ''}
        ${k.role ? `<p class="keynote-role">${esc(k.role)}</p>` : ''}
        ${k.bio ? `<button type="button" class="button secondary on-dark" data-open-keynote>About ${esc(k.name.split(' ')[0])}</button>` : ''}
      </div>
    </article>` : '';
  $('#workshop-count').textContent = workshops.length ? String(workshops.length) : 'our';
  $('#workshop-grid').innerHTML = workshops.map(w => `<button type="button" class="workshop-tile${w.warning ? ' has-warning' : ''}" data-open-workshop="${esc(w.id)}" aria-haspopup="dialog">
      <span class="workshop-tile-photo">${photoSrc(w) ? `<img src="${esc(photoSrc(w))}" alt="" loading="lazy">` : `<span class="workshop-tile-initials">${esc((w.speakerName || w.title).split(' ').map(x => x[0]).slice(0,2).join(''))}</span>`}${w.warning ? '<span class="tile-warning-band"><span aria-hidden="true">&#9888;</span> Allergy warning</span>' : ''}</span>
      <span class="workshop-tile-body">
        <span class="workshop-tile-title">${esc(w.title)}</span>
        ${w.speakerName ? `<span class="workshop-tile-speaker">${esc(w.speakerName)}</span>` : ''}
        ${w.warning ? `<span class="tile-warning-text">${esc(w.warning)}</span>` : ''}
        <span class="tile-tags">${audienceTag(w)}</span>
      </span>
    </button>`).join('');
}

// ---------- Lightboxes ----------
function openModal(d){ if(!d.open) d.showModal(); }
document.addEventListener('click', e => { if(e.target.closest('[data-close-dialog]')) e.target.closest('dialog')?.close(); });
for(const id of ['#who-dialog','#awards-dialog']) $(id).addEventListener('click', e => { if(e.target === e.currentTarget) e.currentTarget.close(); });
const dialog = $('#workshop-dialog');
let dialogReturn = null;
function openDialog(html){
  dialogReturn = document.activeElement;
  $('#dialog-body').innerHTML = html;
  dialog.showModal();
  dialog.scrollTop = 0;
  $('#dialog-close').focus();
}
function workshopHtml(w){
  const runs = (eduhub.sessions || []).filter(x => x.workshopId === w.id);
  return `<div class="lightbox-head">
      ${photoSrc(w) ? `<img src="${esc(photoSrc(w))}" alt="Photo of ${esc(w.speakerName || '')}">` : ''}
      <div>
        <h2 id="dialog-title">${esc(w.title)}</h2>
        ${w.speakerName ? `<p class="lightbox-speaker"><strong>${esc(w.speakerName)}</strong>${w.speakerRole ? `<span>${esc(w.speakerRole)}</span>` : ''}</p>` : ''}
        ${audienceTag(w)}
      </div>
    </div>
    ${w.warning ? `<p class="warning-notice" role="note"><span aria-hidden="true">&#9888;</span> ${esc(w.warning)}</p>` : ''}
    <div class="programme-text">${textHtml(w.description)}</div>
    ${runs.length || w.room ? `<div class="lightbox-facts">
      ${w.room ? `<p><strong>Room:</strong> ${esc(w.room)}</p>` : ''}
      ${runs.length ? `<p><strong>Runs in:</strong></p><ul>${runs.map(x => `<li>${esc(slotLabel(x))}${(x.roundPhases || []).length ? ` <span class="muted">(${x.roundPhases.map(p => PHASE_NAMES[p]).join(' and ')} staff)</span>` : ''}${x.placesLeft === 0 ? ' <span class="status-pill waiting">Full</span>' : ''}</li>`).join('')}</ul>` : ''}
    </div>` : ''}
    ${w.speakerBio ? `<h3>About ${esc(w.speakerName || 'the speaker')}</h3><div class="programme-text">${textHtml(w.speakerBio)}</div>` : ''}`;
}
function keynoteHtml(k){
  return `<div class="lightbox-head">
      ${photoSrc(k) ? `<img src="${esc(photoSrc(k))}" alt="Photo of ${esc(k.name)}">` : ''}
      <div><h2 id="dialog-title">${esc(k.title || k.name)}</h2>
        <p class="lightbox-speaker"><strong>${esc(k.name)}</strong>${k.role ? `<span>${esc(k.role)}</span>` : ''}</p>
        ${times(k) ? `<span class="tag">Keynote, ${esc(times(k))}</span>` : ''}</div>
    </div>
    <div class="programme-text">${textHtml(k.bio)}</div>`;
}
document.addEventListener('click', e => {
  const w = e.target.closest('[data-open-workshop]');
  if(w){
    e.preventDefault();
    const item = (eduhub.workshops || []).find(x => x.id === w.dataset.openWorkshop);
    if(item) openDialog(workshopHtml(item));
    return;
  }
  if(e.target.closest('[data-open-keynote]')) openDialog(keynoteHtml(eduhub.keynote || {}));
});
$('#dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if(e.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => dialogReturn?.focus());

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
    $('#side-places').textContent = e.placesLeft > 0 ? `${e.placesLeft} ${e.placesLeft === 1 ? 'place' : 'places'} remaining` : 'Fully booked. New bookings join the waiting list.';
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

  const schools = e.schools || [];
  if(schools.length){
    $('#organisation-field').classList.add('hidden');
    $('#school-field').classList.remove('hidden');
    $('#schoolId').innerHTML = '<option value="">Please choose</option>' + Object.entries(PHASE_NAMES).map(([p, n]) => {
      const list = schools.filter(x => x.phase === p);
      return list.length ? `<optgroup label="${esc(n)}">${list.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</optgroup>` : '';
    }).join('');
  }
  renderDay();
  renderProgramme();
  $('#role-field').classList.toggle('hidden', e.allowGovernors === false);
  applyRole();
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
  for(const [name, label] of [['firstName','your first name'],['lastName','your surname']]){
    if(!form[name].value.trim()) flag(form[name], `Please enter ${label}.`);
  }
  const role = currentRole();
  const usesSchools = (eduhub.schools || []).length > 0;
  if(role !== 'trustee' && usesSchools && !form.schoolId.value) flag(form.schoolId, role === 'governor' ? 'Please choose the school you govern.' : 'Please choose your school or team.');
  if(role !== 'trustee' && !usesSchools && !form.organisation.value.trim()) flag(form.organisation, role === 'governor' ? 'Please enter the school you govern.' : 'Please enter your school or team.');
  if(eduhub.requireSessionChoice && currentPhase() !== null){
    for(const slot of lastSlots){
      if(!choices[slot.key]) flag($('#session-options'), `Please choose a workshop for ${slot.label}.`);
    }
  }
  const email = form.email.value.trim().toLowerCase();
  if(!email) flag(form.email, 'Please enter your Trust email address.');
  else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) flag(form.email, 'Please enter a valid email address.');
  else if(role === 'staff' && !staffDomains().some(d => email.endsWith(d))) flag(form.email, `Please use your ${domainText()} email address. If you are a governor or trustee, please choose that at the top of the form.`);
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
  const cal = data.preview ? '' : calendarLink();
  const previewNote = data.preview ? `<p class="notice warn"><strong>Preview.</strong> This is what people will see after booking. Nothing has been sent or saved. In the live form, a QR code ticket appears here too.</p>` : '';
  $('#form-message').innerHTML = `<div class="form-shell confirmation" role="status" tabindex="-1">${previewNote}
    <div class="eyebrow teal">${data.waitingList ? 'Waiting list' : 'Booking confirmed'}</div>
    <h2>${data.waitingList ? 'You are on the waiting list' : 'Thank you, your place is booked'}</h2>
    ${data.waitingList ? '<p>EduHub 2027 is currently full. We will contact you if a place becomes available.</p>' : `<p>We look forward to seeing you at ${esc(eduhub.venue || 'Babington Academy')}.</p>`}
    <dl class="confirmation-list">
      ${data.reference ? `<div><dt>Booking reference</dt><dd><strong>${esc(data.reference)}</strong></dd></div>` : ''}
      <div><dt>Name</dt><dd>${esc(body.firstName)} ${esc(body.lastName)}</dd></div>
      <div><dt>Email</dt><dd>${esc(body.email)}</dd></div>
      <div><dt>Date</dt><dd>${fmtDate(eduhub.date)}${eduhub.time ? `, ${esc(eduhub.time)}` : ''}</dd></div>
      ${body.sessionIds.length ? `<div><dt>Workshops</dt><dd>${body.sessionIds.map(id => (eduhub.sessions || []).find(x => x.id === id)).filter(Boolean).map(x => `${esc(slotLabel(x))}: ${esc(x.title)}${x.room ? `, ${esc(x.room)}` : ''}`).join('<br>')}</dd></div>` : ''}
      ${food ? `<div><dt>Food choice</dt><dd>${esc(food)}</dd></div>` : ''}
    </dl>
    ${data.ticketUrl ? `<div class="ticket-inline"><h3>Your ticket</h3>
      <img class="ticket-qr" src="/api/qr?${esc(data.ticketUrl.split('?')[1] || '')}" width="220" height="220" alt="QR code for your booking">
      <p>${data.emailSent ? `We have also emailed this ticket to <strong>${esc(body.email)}</strong>.` : 'Please save or print this page, or keep the link below.'} Bring it with you on the day.</p>
      <p><a href="${esc(data.ticketUrl)}">Open your ticket</a></p></div>` : ''}
    ${eduhub.recognitionUrl ? `<div class="recognition-box">
      <h3>LwLAT Better Together Recognition Awards 2027</h3>
      <p>Do you know a colleague whose work deserves recognition? You can nominate them using a short form.</p>
      <a class="button" href="${esc(eduhub.recognitionUrl)}" target="_blank" rel="noopener">Nominate a colleague<span class="visually-hidden"> (opens Microsoft Forms in a new tab)</span></a>
      <button type="button" class="link-button" data-open-awards>Find out about the awards</button>
    </div>` : ''}
    <p class="muted">Please keep a note of your booking reference. If anything changes, contact the event organiser${eduhub.contactEmail ? ` at <a href="mailto:${esc(eduhub.contactEmail)}">${esc(eduhub.contactEmail)}</a>` : ''}.</p>
    <div class="hero-actions">
      ${cal && !data.waitingList ? `<a class="button" href="${cal}" download="EduHub-2027.ics">Add to my calendar</a>` : ''}
      <button class="button secondary" type="button" id="print-confirmation">Print this page</button>
    </div>
  </div>`;
  $('#print-confirmation').addEventListener('click', () => window.print());
  if(!data.waitingList) setTimeout(openAwards, 700);
  if(data.preview){
    $('.confirmation').insertAdjacentHTML('beforeend', '<p><button class="button secondary" type="button" id="back-to-form">Back to the form</button></p>');
    $('#back-to-form').addEventListener('click', () => { $('#form-message').innerHTML = ''; form.classList.remove('hidden'); form.scrollIntoView({behavior:'smooth'}); });
  }
  $('.confirmation').focus();
}

form.addEventListener('submit', async ev => {
  ev.preventDefault();
  $('#form-message').innerHTML = '';
  if(!validate()) return;
  if(preview){
    // Show the real confirmation screen, clearly marked, without saving anything.
    const body = Object.fromEntries([...new FormData(form).entries()].filter(([k]) => k !== 'round-choice'));
    body.sessionIds = lastSlots.map(sl => choices[sl.key]).filter(Boolean);
    showConfirmation({ reference: 'EH27-PREVIEW', waitingList: false, ticketUrl: '', emailSent: false, preview: true }, body);
    return;
  }
  const button = $('#submit-button');
  button.disabled = true;
  button.textContent = 'Sending your booking';
  const body = Object.fromEntries([...new FormData(form).entries()].filter(([k]) => k !== 'round-choice'));
  body.sessionIds = lastSlots.map(sl => choices[sl.key]).filter(Boolean);
  if((eduhub.schools || []).length && currentRole() !== 'trustee') body.organisation = form.schoolId.selectedOptions[0]?.textContent || '';
  body.itemType = 'eduhub';
  body.itemId = 'eduhub-2027';
  body.consent = form.consent.checked;
  try{
    const res = await fetch('/api/book', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
    const data = await res.json().catch(() => ({}));
    if(!res.ok){
      // A session filled up while the form was open: refresh the numbers.
      if(data.fullSession) await reloadData(false);
      throw new Error(data.error || 'Your booking could not be sent. Please try again.');
    }
    showConfirmation(data, body);
  }catch(err){
    showMessage(`<p>${esc(err.message)}</p>`);
  }finally{
    button.disabled = false;
    button.textContent = 'Book my place';
  }
});

function applyRole(){
  const role = currentRole();
  const schools = (eduhub.schools || []).length > 0;
  $('#email-label').textContent = role === 'staff' ? 'Trust email address' : 'Email address';
  $('#email-help').textContent = role === 'staff' ? `Please use your ${domainText()} email address.` : 'Please use the email address you would like your confirmation sent to.';
  $('#staff-domains-note').textContent = domainText();
  form.email.placeholder = role === 'staff' ? 'firstname.surname@lwlat.org.uk' : '';
  $('#school-label').textContent = role === 'governor' ? 'School you govern' : 'School or team';
  $('#school-field').classList.toggle('hidden', role === 'trustee' || !schools);
  $('#organisation-field').classList.toggle('hidden', role === 'trustee' || schools);
  if(role === 'governor' && !schools) $('#organisation-field label').textContent = 'School you govern';
  renderSessionChoices(); renderYourDay();
  if(role === 'trustee' && who?.key !== 'trustee'){ who = WHO.find(w => w.key === 'trustee'); renderDay(); }
}
form.addEventListener('change', e => { if(e.target.name === 'role') applyRole(); });

form.schoolId.addEventListener('change', () => {
  renderSessionChoices(); renderYourDay();
  const phase = currentPhase();
  if(phase && who && who.phase !== phase){
    const match = WHO.find(w => w.phase === phase && w.role === currentRole());
    if(match){ who = match; try{ localStorage.setItem('eduhub-who', match.key); }catch{} renderDay(); }
  }
});

async function reloadData(full = true){
  try{
    const res = await fetch('/api/public-data', {cache:'no-store'});
    if(!res.ok) throw new Error();
    eduhub = (await res.json()).eduhub || {};
  }catch{
    if(!full) return;
    eduhub = { effectiveStatus:'coming-soon' };
    $('#status-text').textContent = 'Event details are temporarily unavailable. Please try again shortly.';
  }
  if(full) render(); else renderSessionChoices();
}
reloadData();
