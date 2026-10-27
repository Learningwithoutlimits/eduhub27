import './logo-trim.js';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmtDate = v => v ? new Intl.DateTimeFormat('en-GB',{dateStyle:'full'}).format(new Date(v+'T12:00:00')) : '';
const fmtTime = v => v ? new Date(v).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
const params = new URLSearchParams(location.search);
const b = params.get('b') || '', s = params.get('s') || '';
const qs = `b=${encodeURIComponent(b)}&s=${encodeURIComponent(s)}`;

async function load(){
  const res = await fetch(`/api/ticket?${qs}`, {cache:'no-store'});
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || 'This ticket could not be loaded.');
  return data;
}

function details(t){
  const rows = [
    ['Reference', `<strong>${esc(t.reference)}</strong>`],
    ['Event', esc(t.itemTitle)],
    ['Date', esc(fmtDate(t.event.date))],
    ['Time', esc(t.event.time)],
    ['Venue', esc(t.event.venue)],
    ['Sessions', t.sessions.map(x => `${esc(x.time)}: ${esc(x.title)}${x.room ? `, ${esc(x.room)}` : ''}`).join('<br>')]
  ];
  if(t.isAdmin) rows.push(
    ['School or team', `${esc(t.organisation)}${t.phaseName ? ` (${esc(t.phaseName)})` : ''}`],
    ['Food choice', esc(t.foodChoice)], ['Dietary or allergies', esc(t.dietary)], ['Accessibility', esc(t.accessibility)]);
  return `<dl class="confirmation-list">${rows.filter(r => r[1]).map(([k,v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

function renderTicket(t){
  const confirmed = t.status === 'booked';
  $('#ticket').innerHTML = `
    <div class="eyebrow teal">${confirmed ? 'Your ticket' : t.status === 'waiting' ? 'Waiting list' : 'Cancelled booking'}</div>
    <h1 class="ticket-title">${esc(t.firstName)}${t.isAdmin ? ` ${esc(t.lastName)}` : ''}</h1>
    ${confirmed ? `<img class="ticket-qr" src="/api/qr?${qs}" width="260" height="260" alt="QR code for booking ${esc(t.reference)}">
      <p class="ticket-hint">Please show this code at registration. You can also print this page.</p>`
      : t.status === 'waiting' ? '<p class="notice warn">You are on the waiting list. We will email you a ticket if a place becomes available.</p>'
      : '<p class="notice error">This booking has been cancelled.</p>'}
    ${details(t)}
    ${confirmed && !t.isAdmin ? '<button class="button secondary" type="button" id="print-ticket">Print ticket</button>' : ''}`;
  $('#print-ticket')?.addEventListener('click', () => window.print());
}

function showScan(kind, heading, text, actions=''){
  const box = $('#scan-result');
  box.className = `scan-result ${kind}`;
  box.innerHTML = `<p class="scan-heading">${heading}</p>${text ? `<p>${text}</p>` : ''}${actions}`;
}

async function checkIn(force=false, action='checkin'){
  const res = await fetch('/api/ticket', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({b, s, action, force})});
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

async function scan(t){
  const { ok, data } = await checkIn();
  const name = `${esc(t.firstName)} ${esc(t.lastName)}`;
  const undo = '<button class="button secondary" type="button" id="undo-checkin">Undo check-in</button>';
  if(ok && data.already) showScan('warn', `Already checked in`, `${name} was checked in at ${fmtTime(data.checkedInAt)}.`, undo);
  else if(ok) showScan('ok', `Checked in: ${name}`, `${fmtTime(data.checkedInAt)}${t.accessibility ? ' · Has accessibility needs (see below)' : ''}`, undo);
  else showScan('stop', data.canForce ? 'Not a confirmed place' : 'Do not admit', esc(data.error),
    data.canForce ? '<button class="button" type="button" id="force-checkin">Check in anyway</button>' : '');
  $('#undo-checkin')?.addEventListener('click', async () => { await checkIn(false, 'undo'); showScan('warn', 'Check-in undone', name); });
  $('#force-checkin')?.addEventListener('click', async () => { const r = await checkIn(true); if(r.ok) showScan('ok', `Checked in: ${name}`, fmtTime(r.data.checkedInAt)); });
}

(async () => {
  try{
    const t = await load();
    renderTicket(t);
    // view=1 lets administrators look at a ticket without checking anyone in.
    if(t.isAdmin && params.get('view') !== '1'){
      document.body.classList.add('door-mode');
      await scan(t);
    }
  }catch(err){
    $('#ticket').innerHTML = `<h1 class="ticket-title">Ticket not found</h1><p class="notice error">${esc(err.message)}</p>`;
  }
})();
