import { ALLERGENS, SUITABLE_FOR, MATRIX_MENU_2027, allergenSummary } from './allergens.js';
import { WORKSHOP_BOOKLET_2027 } from './workshop-booklet.js';

const $=(s,e=document)=>e.querySelector(s), $$=(s,e=document)=>[...e.querySelectorAll(s)];
let data={courses:[],bookings:[],eduhub:{}};
const EDUHUB_ID='eduhub-2027';
const escapeHtml=str=>String(str??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmt=v=>v?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(v+'T12:00:00')):'—';
const message=(text,type='notice')=>{$('#admin-message').innerHTML=text?`<p class="${type}">${escapeHtml(text)}</p>`:'';if(text)$('#admin-message').scrollIntoView({block:'nearest'})};
const statusOf=b=>b.cancelled||b.status==='cancelled'?'cancelled':b.waitingList?'waiting':'booked';
const STATUS_LABEL={booked:'Booked',waiting:'Waiting list',cancelled:'Cancelled'};
const EDUHUB_STATUS_TEXT={
  'coming-soon':'Coming soon. Staff see "Bookings Open Soon" and no bookings are accepted.',
  'open':'Open. Members of staff can book on the EduHub page now.',
  'closed':'Closed. Staff see "Bookings closed" and no bookings are accepted.'
};

async function api(path,opts={}){
  const res=await fetch('/api/'+path,{headers:{'content-type':'application/json',...(opts.headers||{})},cache:'no-store',...opts});
  if(res.status===401&&path!=='login'){showLogin();throw new Error('Please sign in again.')}
  const contentType=res.headers.get('content-type')||'';
  const body=contentType.includes('json')?await res.json():await res.text();
  if(!res.ok) throw new Error(body.error||body||'Request failed');
  return body;
}
function showLogin(){$('#login-view').classList.remove('hidden');$('#admin-view').classList.add('hidden')}
function showAdmin(){$('#login-view').classList.add('hidden');$('#admin-view').classList.remove('hidden')}
async function boot(){
  try{await api('session');showAdmin();await refresh()}catch{showLogin()}
}
$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const lf=e.currentTarget, btn=lf.querySelector('button');btn.disabled=true;
  try{await api('login',{method:'POST',body:JSON.stringify({password:lf.password.value})});$('#login-message').innerHTML='';lf.reset();showAdmin();await refresh()}
  catch(err){$('#login-message').innerHTML=`<p class="notice error">${escapeHtml(err.message)}</p>`}
  finally{btn.disabled=false}
});
$('#logout').addEventListener('click',async()=>{await api('logout',{method:'POST'}).catch(()=>{});showLogin()});
$$('.side-nav [data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
function switchView(name){
  if(eduhubDirty && name!=='eduhub' && !confirm('You have unsaved EduHub changes. Leave without saving?')) return;
  if(name!=='eduhub' && eduhubDirty){eduhubDirty=false;renderEduhubForm()}
  if(programmeDirty && name!=='programme' && !confirm('You have unsaved changes to the sessions. Leave without saving?')) return;
  if(name!=='programme' && programmeDirty){programmeDirty=false;renderProgrammeForm()}
  $$('.admin-section').forEach(s=>s.classList.add('hidden'));$('#'+name+'-view').classList.remove('hidden');
  $$('.side-nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  $('#view-title').textContent={overview:'Overview',courses:'Professional Learning',eduhub:'EduHub 2027',programme:'EduHub sessions',bookings:'Bookings'}[name];
  message('');
}
async function refresh({keepEduhubForm=eduhubDirty,keepProgrammeForm=programmeDirty}={}){
  data=await api('admin-data');renderAll({keepEduhubForm,keepProgrammeForm});
}

// ---------- Overview and courses ----------
const nextDate=c=>{const d=(Array.isArray(c.sessions)&&c.sessions.length?c.sessions:[{date:c.date}]).map(s=>s.date).filter(Boolean).sort();return d.find(x=>x>=new Date().toISOString().slice(0,10))||d[d.length-1]||''};
const countFor=(id,status)=>data.bookings.filter(b=>b.itemId===id&&statusOf(b)===status).length;

function renderAll({keepEduhubForm=false,keepProgrammeForm=false}={}){
  const active=b=>statusOf(b)!=='cancelled';
  $('#stat-published').textContent=data.courses.filter(c=>c.status==='published').length;
  $('#stat-drafts').textContent=data.courses.filter(c=>c.status==='draft').length;
  $('#stat-course-bookings').textContent=data.bookings.filter(b=>b.itemId!==EDUHUB_ID&&active(b)).length;
  $('#stat-eduhub-bookings').textContent=data.bookings.filter(b=>b.itemId===EDUHUB_ID&&active(b)).length;
  $('#overview-eduhub-status').textContent=EDUHUB_STATUS_TEXT[data.eduhub.effectiveStatus]||'';
  const ehConfirmed=data.bookings.filter(b=>b.itemId===EDUHUB_ID&&statusOf(b)==='booked');
  $('#overview-checkins').textContent=ehConfirmed.length?`${ehConfirmed.filter(b=>b.checkedInAt).length} of ${ehConfirmed.length} confirmed EduHub places checked in.`:'';
  $('#email-status').innerHTML=data.emailConfigured
    ?`<span class="email-ok"><strong>Switched on.</strong></span> Confirmation emails with QR codes are sent from <strong>${escapeHtml(data.mailFrom)}</strong> when someone books.`
    :'<strong>Not set up yet.</strong> Bookings still work, but no emails are sent. Your IT team need to add four settings in Netlify. The steps are in docs/EMAIL-SETUP-FOR-IT.md.';
  $('#email-test-form').classList.toggle('hidden',!data.emailConfigured);
  $('#courses-table').innerHTML=data.courses.length?data.courses.map(c=>{
    const booked=countFor(c.id,'booked'), waiting=countFor(c.id,'waiting');
    return `<tr><td><strong>${escapeHtml(c.title)}</strong><br><span class="muted">${escapeHtml(c.audience||'')}</span></td><td>${fmt(nextDate(c))}</td><td>${escapeHtml(c.status)}</td><td>${c.bookingOpen===false?'Closed':'Open'}${c.bookingDeadline?`<br><span class="muted">until ${fmt(c.bookingDeadline)}</span>`:''}</td><td>${booked}${Number(c.capacity)?` of ${escapeHtml(c.capacity)}`:''}${waiting?`<br><span class="muted">${waiting} waiting</span>`:''}</td><td><div class="actions"><button class="ghost preview-course" data-id="${escapeHtml(c.id)}">Preview</button><button class="ghost edit-course" data-id="${escapeHtml(c.id)}">Edit</button><button class="ghost duplicate-course" data-id="${escapeHtml(c.id)}">Duplicate</button><button class="ghost view-course-bookings" data-id="${escapeHtml(c.id)}">Bookings</button><button class="danger delete-course" data-id="${escapeHtml(c.id)}">Delete</button></div></td></tr>`}).join(''):'<tr><td colspan="6">No opportunities have been created yet.</td></tr>';
  bindCourseActions();
  if(!keepEduhubForm) renderEduhubForm();
  if(!keepProgrammeForm) renderProgrammeForm();
  renderSessionSummary();
  renderCatering();
  renderBookingFilters();
  renderBookings();
}

// ---------- EduHub settings ----------
const ef=$('#eduhub-form');
const foodBuilder=$('#food-choice-builder');
let eduhubDirty=false;
const markDirty=()=>{eduhubDirty=true;$('#eduhub-dirty').textContent='You have unsaved changes.'};
ef.addEventListener('input',markDirty);
ef.addEventListener('change',markDirty);
window.addEventListener('beforeunload',e=>{if(eduhubDirty||programmeDirty){e.preventDefault();e.returnValue=''}});

function renderEduhubForm(){
  const e=data.eduhub||{};
  for(const k of ['title','date','time','venue','description','capacity','bookingDeadline','contactEmail','privacyNoticeUrl','recognitionUrl']) ef.elements[k].value=e[k]??'';
  for(const k of ['askDietary','askAccessibility','allowNoFood']) ef.elements[k].checked=Boolean(e[k]);
  $$('[name=bookingStatus]',ef).forEach(r=>r.checked=r.value===(e.bookingStatus||'coming-soon'));
  const live=$('#eduhub-live-status');
  live.textContent=`Live now: ${EDUHUB_STATUS_TEXT[e.effectiveStatus]||''}${e.bookingStatus==='open'&&e.effectiveStatus==='closed'?' The booking deadline or event date has passed.':''}`;
  live.className=`notice ${e.effectiveStatus==='open'?'':'warn'}`;
  foodBuilder.innerHTML='';
  (Array.isArray(e.foodChoices)?e.foodChoices:[]).forEach(c=>addFoodChoiceRow(c));
  if(!foodBuilder.children.length) foodBuilder.innerHTML='<p class="empty small" data-empty>No food choices yet. Add them one by one, or fill them in from the allergen matrix.</p>';
  eduhubDirty=false;$('#eduhub-dirty').textContent='';
}

function addFoodChoiceRow(choice={}){
  foodBuilder.querySelector('[data-empty]')?.remove();
  const row=document.createElement('fieldset');
  row.className='food-row';
  row.dataset.id=choice.id||'';
  const n=foodBuilder.querySelectorAll('.food-row').length+1;
  const uid=`f${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
  const has=code=>(choice.allergens||[]).includes(code);
  row.innerHTML=`<legend>Food choice ${n}</legend>
    <div class="food-row-grid">
      <div class="field"><label for="${uid}-name">Name</label><input id="${uid}-name" data-f="name" value="${escapeHtml(choice.name||'')}" maxlength="120" placeholder="e.g. Quorn Sausage Casserole"></div>
      <div class="field"><label for="${uid}-group">Heading <span class="optional">(optional)</span></label><input id="${uid}-group" data-f="group" value="${escapeHtml(choice.group||'')}" maxlength="60" placeholder="e.g. Hot meals"></div>
      <div class="field full"><label for="${uid}-desc">Description <span class="optional">(optional)</span></label><input id="${uid}-desc" data-f="description" value="${escapeHtml(choice.description||'')}" maxlength="300"></div>
    </div>
    <div class="allergen-grid" role="group" aria-label="Allergens in this option">
      ${ALLERGENS.map(a=>`<label class="allergen-check" title="${escapeHtml(a.full)}"><input type="checkbox" data-allergen="${a.code}" ${has(a.code)?'checked':''}> <span>${escapeHtml(a.name)}</span></label>`).join('')}
    </div>
    <div class="food-row-grid">
      <div class="field ${has('GL')?'':'hidden'}" data-show="GL"><label for="${uid}-cereal">Which cereals?</label><input id="${uid}-cereal" data-f="cerealTypes" value="${escapeHtml(choice.cerealTypes||'')}" placeholder="e.g. Wheat, Barley" maxlength="80"></div>
      <div class="field ${has('TN')?'':'hidden'}" data-show="TN"><label for="${uid}-nuts">Which tree nuts?</label><input id="${uid}-nuts" data-f="treeNutTypes" value="${escapeHtml(choice.treeNutTypes||'')}" placeholder="e.g. Almond, Cashew" maxlength="120"></div>
    </div>
    <div class="suitable-row"><span class="muted">Suitable for:</span>
      ${SUITABLE_FOR.map(s=>`<label class="allergen-check"><input type="checkbox" data-suitable="${s.code}" ${(choice.suitableFor||[]).includes(s.code)?'checked':''}> <span>${escapeHtml(s.name)}</span></label>`).join('')}
    </div>
    <div class="food-row-footer">
      <label class="check-label confirm-check"><input type="checkbox" data-f-confirmed ${choice.allergensConfirmed?'checked':''}> Allergen details checked with the caterer</label>
      <div class="actions">
        <button type="button" class="ghost" data-move="-1" aria-label="Move up">Move up</button>
        <button type="button" class="ghost" data-move="1" aria-label="Move down">Move down</button>
        <button type="button" class="danger" data-remove>Remove</button>
      </div>
    </div>
    <p class="food-row-summary muted"></p>`;
  const update=()=>{
    const c=readFoodRow(row);
    $$('[data-show]',row).forEach(el=>el.classList.toggle('hidden',!c.allergens.includes(el.dataset.show)));
    const summary=allergenSummary(c);
    row.querySelector('.food-row-summary').textContent=`Staff will see: ${summary?`Contains: ${summary}`:c.allergensConfirmed?'Contains none of the 14 main allergens':'Please check the allergen matrix for this option'}`;
    row.classList.toggle('unconfirmed',!c.allergensConfirmed);
  };
  row.addEventListener('change',update);row.addEventListener('input',update);
  row.querySelector('[data-remove]').onclick=()=>{if(confirm(`Remove "${readFoodRow(row).name||'this food choice'}"?`)){row.remove();renumberFood();markDirty()}};
  $$('[data-move]',row).forEach(b=>b.onclick=()=>{
    const dir=Number(b.dataset.move);
    if(dir<0&&row.previousElementSibling) foodBuilder.insertBefore(row,row.previousElementSibling);
    if(dir>0&&row.nextElementSibling) foodBuilder.insertBefore(row.nextElementSibling,row);
    renumberFood();markDirty();
  });
  foodBuilder.appendChild(row);update();
  return row;
}
function renumberFood(){$$('.food-row',foodBuilder).forEach((r,i)=>r.querySelector('legend').textContent=`Food choice ${i+1}`)}
function readFoodRow(row){
  const v=f=>row.querySelector(`[data-f="${f}"]`)?.value.trim()||'';
  return {id:row.dataset.id||'',name:v('name'),group:v('group'),description:v('description'),
    allergens:$$('[data-allergen]:checked',row).map(i=>i.dataset.allergen),
    cerealTypes:v('cerealTypes'),treeNutTypes:v('treeNutTypes'),
    suitableFor:$$('[data-suitable]:checked',row).map(i=>i.dataset.suitable),
    allergensConfirmed:row.querySelector('[data-f-confirmed]').checked};
}
const readFoodChoices=()=>$$('.food-row',foodBuilder).map(readFoodRow).filter(c=>c.name);

$('#add-food-choice').addEventListener('click',()=>{addFoodChoiceRow().querySelector('input').focus();markDirty()});
$('#load-matrix-menu').addEventListener('click',()=>{
  const existing=new Set(readFoodChoices().map(c=>c.name.toLowerCase()));
  const toAdd=MATRIX_MENU_2027.filter(c=>!existing.has(c.name.toLowerCase()));
  if(!toAdd.length){message('Every item from the allergen matrix is already in the list.');return}
  if(!confirm(`Add ${toAdd.length} food choices from the EduHub 2027 allergen matrix?\n\nPlease check each one against the caterer's latest information, tick "Allergen details checked with the caterer", then save.`)) return;
  toAdd.forEach(c=>addFoodChoiceRow({...c,allergensConfirmed:false}));
  renumberFood();markDirty();
  message(`${toAdd.length} food choices added from the allergen matrix. They are not saved yet. Please check them, then press Save EduHub settings.`,'notice warn');
});

ef.addEventListener('submit',async e=>{
  e.preventDefault();
  const obj=Object.fromEntries(['title','date','time','venue','description','bookingDeadline','contactEmail','privacyNoticeUrl','recognitionUrl'].map(k=>[k,ef.elements[k].value.trim()]));
  obj.section='details';
  obj.capacity=Number(ef.elements.capacity.value)||0;
  for(const k of ['askDietary','askAccessibility','allowNoFood']) obj[k]=ef.elements[k].checked;
  obj.bookingStatus=$('[name=bookingStatus]:checked',ef)?.value||'coming-soon';
  obj.foodChoices=readFoodChoices();
  if(!obj.title){message('Please enter an event title.','notice error');return}
  const unnamed=$$('.food-row',foodBuilder).map(readFoodRow).filter(c=>!c.name&&(c.allergens.length||c.description));
  if(unnamed.length){message('One of the food choices has allergens ticked but no name. Please add a name or remove it.','notice error');return}
  if(obj.bookingStatus==='open'&&data.eduhub.bookingStatus!=='open'){
    const unchecked=obj.foodChoices.filter(c=>!c.allergensConfirmed).length;
    const checks=['Open EduHub bookings now? Members of staff will be able to book straight away.','','Before opening, please make sure that:','• the Data Protection Officer has approved the booking form','• the menu and allergens have been checked with the caterer'];
    if(unchecked) checks.push('',`Warning: ${unchecked} food choice${unchecked===1?' has':'s have'} not been marked as checked with the caterer.`);
    if(!obj.foodChoices.length) checks.push('','Warning: there are no food choices, so the form will not ask about food.');
    if(!confirm(checks.join('\n'))) return;
    if(!obj.foodChoices.length) obj.confirmNoFood=true;
  }
  const btn=ef.querySelector('button[type=submit]');btn.disabled=true;
  try{await api('eduhub',{method:'POST',body:JSON.stringify(obj)});eduhubDirty=false;await refresh({keepEduhubForm:false});message('EduHub settings saved.')}
  catch(err){message(`EduHub settings were not saved: ${err.message}`,'notice error')}
  finally{btn.disabled=false}
});
$('#preview-eduhub').addEventListener('click',()=>{
  if(eduhubDirty) alert('The preview shows the saved settings. Save your changes first to see them in the preview.');
  window.open('/eduhub/?preview=1','_blank','noopener');
});

function renderCatering(){
  const confirmed=data.bookings.filter(b=>b.itemId===EDUHUB_ID&&statusOf(b)==='booked');
  if(!confirmed.length){$('#catering-summary').innerHTML='<p class="muted">No confirmed EduHub bookings yet.</p>';return}
  const counts=new Map();
  for(const b of confirmed){const k=b.foodChoice||'No food choice recorded';counts.set(k,(counts.get(k)||0)+1)}
  const order=(data.eduhub.foodChoices||[]).map(c=>c.name);
  const rows=[...counts].sort((a,b)=>{const ia=order.indexOf(a[0]),ib=order.indexOf(b[0]);return (ia<0?999:ia)-(ib<0?999:ib)||a[0].localeCompare(b[0])});
  const dietary=confirmed.filter(b=>String(b.dietary||'').trim());
  const access=confirmed.filter(b=>String(b.accessibility||'').trim()).length;
  $('#catering-summary').innerHTML=`
    <div class="stat-grid three"><div class="stat"><span>Confirmed places</span><strong>${confirmed.length}</strong></div><div class="stat"><span>With dietary needs or allergies</span><strong>${dietary.length}</strong></div><div class="stat"><span>With accessibility needs</span><strong>${access}</strong></div></div>
    <div class="table-wrap"><table class="compact"><thead><tr><th>Food choice</th><th>Number</th></tr></thead><tbody>${rows.map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td><strong>${v}</strong></td></tr>`).join('')}</tbody></table></div>
    ${dietary.length?`<h3>Dietary requirements and allergies</h3><div class="table-wrap"><table class="compact"><thead><tr><th>Name</th><th>School or team</th><th>Food choice</th><th>Details</th></tr></thead><tbody>${dietary.map(b=>`<tr><td>${escapeHtml(b.firstName)} ${escapeHtml(b.lastName)}</td><td>${escapeHtml(b.organisation)}</td><td>${escapeHtml(b.foodChoice||'')}</td><td>${escapeHtml(b.dietary)}</td></tr>`).join('')}</tbody></table></div>`:''}`;
}

// ---------- Bookings ----------
function renderBookingFilters(){
  const sel=$('#booking-item'), current=sel.value;
  const ids=[...new Set(data.bookings.map(b=>b.itemId))];
  const title=id=>id===EDUHUB_ID?(data.eduhub.title||'EduHub 2027'):(data.courses.find(c=>c.id===id)?.title||data.bookings.find(b=>b.itemId===id)?.itemTitle||id);
  sel.innerHTML=`<option value="">All bookings</option><option value="eduhub">${escapeHtml(data.eduhub.title||'EduHub 2027')}</option><option value="courses">All Professional Learning</option>`+
    ids.filter(id=>id!==EDUHUB_ID).map(id=>`<option value="${escapeHtml(id)}">${escapeHtml(title(id))}</option>`).join('');
  sel.value=[...sel.options].some(o=>o.value===current)?current:'';
}
function filteredBookings(){
  const q=$('#booking-search').value.trim().toLowerCase(), item=$('#booking-item').value, status=$('#booking-status').value;
  return data.bookings.filter(b=>{
    if(item==='eduhub'&&b.itemId!==EDUHUB_ID) return false;
    if(item==='courses'&&b.itemId===EDUHUB_ID) return false;
    if(item&&!['eduhub','courses'].includes(item)&&b.itemId!==item) return false;
    if(status&&statusOf(b)!==status) return false;
    if(!q) return true;
    return [b.reference,b.firstName,b.lastName,`${b.firstName} ${b.lastName}`,b.email,b.organisation,b.jobTitle,b.itemTitle,b.foodChoice,...(b.sessions||[]).map(x=>x.title)].join(' ').toLowerCase().includes(q);
  });
}
function renderBookings(){
  const rows=filteredBookings();
  const item=$('#booking-item').value;
  $('#export-link').href='/api/export-bookings'+(item?`?item=${encodeURIComponent(item)}`:'');
  $('#booking-count').textContent=`${rows.length} of ${data.bookings.length} bookings shown`;
  $('#bookings-table').innerHTML=rows.length?rows.map(b=>{
    const st=statusOf(b);
    const needs=[(b.sessions||[]).length?`<strong>Sessions:</strong> ${b.sessions.map(x=>`${escapeHtml(x.time)} ${escapeHtml(x.title)}`).join('<br>')}`:'',b.foodChoice?`<strong>Food:</strong> ${escapeHtml(b.foodChoice)}`:'',b.foodAllergens?`<span class="muted">Contains: ${escapeHtml(b.foodAllergens)}</span>`:'',b.dietary?`<strong>Dietary:</strong> ${escapeHtml(b.dietary)}`:'',b.accessibility?`<strong>Access:</strong> ${escapeHtml(b.accessibility)}`:'',b.notes?`<strong>Notes:</strong> ${escapeHtml(b.notes)}`:'',b.adminNotes?`<strong>Admin:</strong> ${escapeHtml(b.adminNotes)}`:''].filter(Boolean).join('<br>');
    return `<tr class="${st==='cancelled'?'row-cancelled':''}"><td>${new Date(b.createdAt).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}${b.reference?`<br><span class="muted">${escapeHtml(b.reference)}</span>`:''}</td>
      <td><strong>${escapeHtml(b.firstName)} ${escapeHtml(b.lastName)}</strong><br>${escapeHtml(b.jobTitle||'')}${b.jobTitle?'<br>':''}${escapeHtml(b.organisation)}${b.phaseName?` <span class="muted">(${escapeHtml(b.phaseName)})</span>`:''}<br><a href="mailto:${escapeHtml(b.email)}">${escapeHtml(b.email)}</a>${b.telephone?`<br>${escapeHtml(b.telephone)}`:''}</td>
      <td>${escapeHtml(b.itemTitle)}</td><td class="needs-cell">${needs||'<span class="muted">None given</span>'}</td>
      <td><span class="status-pill ${st}">${STATUS_LABEL[st]}</span>${b.checkedInAt?`<br><span class="status-pill checkin-pill">Checked in ${new Date(b.checkedInAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>`:''}
        <br><span class="small ${b.emailSentAt?'email-ok':b.emailError?'email-fail':'muted'}" title="${escapeHtml(b.emailError||'')}">${b.emailSentAt?'Email sent':b.emailError?'Email failed':'No email sent'}</span></td>
      <td><div class="actions">
        <button class="ghost" data-booking-edit="${escapeHtml(b.id)}">Edit</button>
        ${st==='waiting'?`<button class="ghost" data-booking-action="confirm" data-id="${escapeHtml(b.id)}">Give place</button>`:''}
        ${st==='booked'?(b.checkedInAt?`<button class="ghost" data-booking-action="undo-checkin" data-id="${escapeHtml(b.id)}">Undo check-in</button>`:`<button class="ghost" data-booking-action="checkin" data-id="${escapeHtml(b.id)}">Check in</button>`):''}
        ${st==='booked'&&b.ticketSig?`<a class="button ghost" href="/ticket/?b=${encodeURIComponent(b.id)}&amp;s=${encodeURIComponent(b.ticketSig)}&amp;view=1" target="_blank" rel="noopener">View ticket</a>`:''}
        ${data.emailConfigured&&st!=='cancelled'?`<button class="ghost" data-booking-action="resend" data-id="${escapeHtml(b.id)}">Resend email</button>`:''}
        ${st==='cancelled'?`<button class="ghost" data-booking-action="reinstate" data-id="${escapeHtml(b.id)}">Reinstate</button>`:`<button class="ghost" data-booking-action="cancel" data-id="${escapeHtml(b.id)}">Cancel</button>`}
        <button class="danger" data-booking-delete="${escapeHtml(b.id)}">Delete</button>
      </div></td></tr>`}).join(''):'<tr><td colspan="6">No matching bookings.</td></tr>';
  $$('[data-booking-action]').forEach(b=>b.onclick=()=>bookingAction(b.dataset.id,b.dataset.bookingAction));
  $$('[data-booking-edit]').forEach(b=>b.onclick=()=>openBookingEdit(b.dataset.bookingEdit));
  $$('[data-booking-delete]').forEach(b=>b.onclick=()=>deleteBooking(b.dataset.bookingDelete));
}
['#booking-search','#booking-item','#booking-status'].forEach(s=>$(s).addEventListener('input',renderBookings));

async function bookingAction(id,action){
  const b=data.bookings.find(x=>x.id===id);
  const name=`${b?.firstName||''} ${b?.lastName||''}`.trim();
  const prompts={cancel:`Cancel the booking for ${name}? The place will be freed up. You can reinstate it later.`,confirm:`Give ${name} a confirmed place? This may take the event over its capacity.${data.emailConfigured?' They will be emailed their ticket.':''}`,reinstate:`Reinstate the booking for ${name}?`,resend:`Send ${name} their confirmation email again?`};
  if(prompts[action]&&!confirm(prompts[action])) return;
  try{
    const r=await api('booking',{method:'POST',body:JSON.stringify({id,action})});await refresh();
    message(r.email?(r.email.sent?`Done. The email to ${name} has been sent.`:`Booking updated, but the email was not sent: ${r.email.reason==='not-configured'?'email is not set up yet.':r.email.reason}`):'Booking updated.',r.email&&!r.email.sent?'notice warn':'notice');
  }
  catch(err){message(err.message,'notice error')}
}
async function deleteBooking(id){
  const b=data.bookings.find(x=>x.id===id);
  if(!confirm(`Permanently delete the booking for ${b?.firstName||''} ${b?.lastName||''}?\n\nThis cannot be undone. Use Cancel instead if you only want to free up the place.`)) return;
  try{await api('booking',{method:'DELETE',body:JSON.stringify({id})});await refresh();message('Booking deleted.')}
  catch(err){message(err.message,'notice error')}
}
const bookingModal=$('#booking-modal'), bf=$('#booking-edit-form');
function openBookingEdit(id){
  const b=data.bookings.find(x=>x.id===id); if(!b) return;
  bf.reset(); bf.id.value=b.id;
  for(const k of ['firstName','lastName','organisation','jobTitle','telephone','dietary','accessibility','notes','adminNotes']) bf.elements[k].value=b[k]||'';
  $('#booking-modal-ref').textContent=`${b.reference||'Booking'} · ${b.email}`;
  const isEduhub=b.itemId===EDUHUB_ID;
  $('#b-food-field').classList.toggle('hidden',!isEduhub);
  const schools=data.eduhub.schools||[], useSchools=isEduhub&&schools.length>0;
  $('#b-school-field').classList.toggle('hidden',!useSchools);
  $('#b-org-field').classList.toggle('hidden',useSchools);
  if(useSchools){
    $('#b-school').innerHTML=(b.schoolId&&schools.some(x=>x.id===b.schoolId)?'':`<option value="">${escapeHtml(b.organisation||'Choose a school')}</option>`)+schoolOptions(schools);
    $('#b-school').value=b.schoolId||'';
  }
  const sessions=data.eduhub.sessions||[];
  $('#b-sessions-field').classList.toggle('hidden',!isEduhub||!sessions.length);
  $('#b-sessions').innerHTML=slotsOf(sessions).map((slot,i)=>`<div class="field"><label for="b-slot-${i}">${escapeHtml(slot.label)}</label><select id="b-slot-${i}" data-slot><option value="">No session</option>${slot.items.map(x=>`<option value="${escapeHtml(x.id)}" ${(b.sessionIds||[]).includes(x.id)?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}</select></div>`).join('');
  if(isEduhub){
    const choices=data.eduhub.foodChoices||[];
    const known=choices.some(c=>c.id===b.foodChoiceId)||b.foodChoiceId==='no-food'||!b.foodChoiceId;
    $('#b-food').innerHTML=`<option value="">No choice recorded</option>`+
      (!known?`<option value="${escapeHtml(b.foodChoiceId)}">${escapeHtml(b.foodChoice)} (no longer on the menu)</option>`:'')+
      choices.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')+
      `<option value="no-food">No food required</option>`;
    $('#b-food').value=b.foodChoiceId||'';
  }
  bookingModal.classList.add('open');bookingModal.setAttribute('aria-hidden','false');bf.firstName.focus();
}
const closeBookingModal=()=>{bookingModal.classList.remove('open');bookingModal.setAttribute('aria-hidden','true')};
$('[data-close-booking]').addEventListener('click',closeBookingModal);
bf.addEventListener('submit',async e=>{
  e.preventDefault();
  const b=data.bookings.find(x=>x.id===bf.id.value);
  const fields=Object.fromEntries(['firstName','lastName','organisation','jobTitle','telephone','dietary','accessibility','notes','adminNotes'].map(k=>[k,bf.elements[k].value]));
  if(b?.itemId===EDUHUB_ID&&bf.foodChoiceId.value!==(b.foodChoiceId||'')) fields.foodChoiceId=bf.foodChoiceId.value;
  if(b?.itemId===EDUHUB_ID&&!$('#b-school-field').classList.contains('hidden')&&bf.schoolId.value&&bf.schoolId.value!==b.schoolId) fields.schoolId=bf.schoolId.value;
  if(b?.itemId===EDUHUB_ID&&(data.eduhub.sessions||[]).length) fields.sessionIds=$$('[data-slot]',bf).map(x=>x.value).filter(Boolean);
  try{await api('booking',{method:'POST',body:JSON.stringify({id:bf.id.value,action:'update',fields})});closeBookingModal();await refresh();message('Booking saved.')}
  catch(err){message(err.message,'notice error')}
});

$('#email-test-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=e.currentTarget.querySelector('button');btn.disabled=true;
  try{await api('email-test',{method:'POST',body:JSON.stringify({to:$('#email-test-to').value})});message(`Test email sent to ${$('#email-test-to').value}. It may take a minute to arrive.`)}
  catch(err){message(err.message,'notice error')}
  finally{btn.disabled=false}
});

// ---------- Course editor ----------
const modal=$('#course-modal'), cf=$('#course-form');
const sessionBuilder=$('#session-builder');

function addSessionRow(session={}){
  const row=document.createElement('div');
  row.className='session-row';
  row.innerHTML=`
    <div class="field"><label>Session name</label><input data-session="label" value="${escapeHtml(session.label||'')}" placeholder="e.g. Session 1"></div>
    <div class="field"><label>Date</label><input data-session="date" type="date" value="${escapeHtml(session.date||'')}"></div>
    <div class="field"><label>Time</label><input data-session="time" value="${escapeHtml(session.time||'')}" placeholder="e.g. 09:30 to 15:30"></div>
    <button type="button" class="danger remove-session">Remove</button>`;
  row.querySelector('.remove-session').onclick=()=>{
    if(sessionBuilder.children.length===1){row.querySelectorAll('input').forEach(i=>i.value='');return}
    row.remove();
  };
  sessionBuilder.appendChild(row);
}
function readSessions(){
  return [...sessionBuilder.querySelectorAll('.session-row')].map((row,i)=>({
    label:row.querySelector('[data-session="label"]').value.trim() || `Session ${i+1}`,
    date:row.querySelector('[data-session="date"]').value,
    time:row.querySelector('[data-session="time"]').value.trim()
  })).filter(s=>s.date||s.time);
}
$('#add-session').addEventListener('click',()=>addSessionRow({label:`Session ${sessionBuilder.children.length+1}`}));

$('#add-course').addEventListener('click',()=>openCourse());
const closeCourse=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true')};
$('[data-close-course]').addEventListener('click',closeCourse);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCourse();closeBookingModal()}});
function openCourse(course={}){
  cf.reset();
  Object.entries(course).forEach(([k,v])=>{
    if(!cf.elements[k]||k==='sessions') return;
    if(k==='askDietary') cf.elements[k].checked=Boolean(v);
    else cf.elements[k].value=typeof v==='boolean'?String(v):v??'';
  });
  sessionBuilder.innerHTML='';
  const sessions=Array.isArray(course.sessions)&&course.sessions.length?course.sessions:
    ((course.date||course.time)?[{label:'Session 1',date:course.date||'',time:course.time||''}]:[{label:'Session 1'}]);
  sessions.forEach(addSessionRow);
  $('#course-modal-title').textContent=course.id?'Edit opportunity':'Add opportunity';modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  cf.title.focus();
}
function bindCourseActions(){
  $$('.preview-course').forEach(b=>b.onclick=()=>window.open(`/preview.html?type=course&id=${encodeURIComponent(b.dataset.id)}`,'_blank'));
  $$('.edit-course').forEach(b=>b.onclick=()=>openCourse(data.courses.find(c=>c.id===b.dataset.id)));
  $$('.duplicate-course').forEach(b=>b.onclick=()=>{const src=data.courses.find(c=>c.id===b.dataset.id);openCourse({...src,id:'',title:src.title+' (copy)',status:'draft'})});
  $$('.view-course-bookings').forEach(b=>b.onclick=()=>{switchView('bookings');$('#booking-item').value=b.dataset.id;renderBookings()});
  $$('.delete-course').forEach(b=>b.onclick=async()=>{
    const n=data.bookings.filter(x=>x.itemId===b.dataset.id).length;
    if(confirm(`Delete this opportunity?${n?` Its ${n} booking${n===1?'':'s'} will stay in the bookings list.`:''}`)){
      try{await api('course',{method:'DELETE',body:JSON.stringify({id:b.dataset.id})});await refresh();message('Opportunity deleted.')}
      catch(err){message(err.message,'notice error')}
    }
  });
}
cf.addEventListener('submit',async e=>{
  e.preventDefault();
  const obj=Object.fromEntries(new FormData(cf).entries());
  obj.bookingOpen=obj.bookingOpen==='true';
  obj.capacity=Number(obj.capacity)||0;
  obj.askDietary=cf.elements.askDietary.checked;
  obj.sessions=readSessions();
  try{
    await api('course',{method:'POST',body:JSON.stringify(obj)});
    closeCourse();
    await refresh();
    message('Opportunity saved successfully.');
  }catch(err){
    message(`The opportunity was not saved: ${err.message}`,'notice error');
  }
});
// ---------- EduHub sessions: keynote, rounds, workshops, schools ----------
const PHASES=[['primary','Primary'],['secondary','Secondary'],['central','Central Trust']];
const AUDIENCES=[['all','Open to all'],['educators','All educators'],['leaders','Anyone who leads a team']];
const pf=$('#programme-form'), schoolBuilder=$('#school-builder'), roundBuilder=$('#round-builder'), workshopBuilder=$('#workshop-builder');
let programmeDirty=false;
const markProgrammeDirty=()=>{programmeDirty=true;$('#programme-dirty').textContent='You have unsaved changes.'};
pf.addEventListener('input',markProgrammeDirty);pf.addEventListener('change',markProgrammeDirty);
const slotLabel=s=>{const t=s.startTime?`${s.startTime}${s.endTime?` to ${s.endTime}`:''}`:'';return s.roundLabel?(t?`${s.roundLabel}, ${t}`:s.roundLabel):(t||'Time to be confirmed')};
function slotsOf(sessions){
  const slots=[];
  for(const x of sessions){const k=x.roundId||`${x.startTime}-${x.endTime}`;let sl=slots.find(y=>y.key===k);if(!sl)slots.push(sl={key:k,label:slotLabel(x),items:[]});sl.items.push(x)}
  return slots;
}
const schoolOptions=schools=>PHASES.map(([p,n])=>{const list=schools.filter(x=>x.phase===p);return list.length?`<optgroup label="${n}">${list.map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)}</option>`).join('')}</optgroup>`:''}).join('');
const photoSrc=x=>x.photoId?`/api/photo?id=${encodeURIComponent(x.photoId)}`:(x.photoPath||'');

// Shrinks a photo in the browser before upload, so pages stay quick to load.
async function shrinkPhoto(file){
  const img=await createImageBitmap(file);
  const scale=Math.min(1,600/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',0.85);
}
// A photo picker that remembers either an uploaded photo or a bundled one.
function photoPicker(holder,x={}){
  const uid=`ph${Math.random().toString(36).slice(2,8)}`;
  holder.dataset.photoId=x.photoId||'';holder.dataset.photoPath=x.photoPath||'';
  holder.innerHTML=`<div class="speaker-photo" data-photo-box></div>
    <label class="button secondary small-button" for="${uid}">Choose photo</label>
    <input type="file" id="${uid}" accept="image/jpeg,image/png,image/webp" class="visually-hidden" data-photo-file>
    <button type="button" class="ghost small-button" data-photo-remove>Remove photo</button>
    <span class="muted small" data-photo-status></span>`;
  const show=()=>{const src=photoSrc({photoId:holder.dataset.photoId,photoPath:holder.dataset.photoPath});
    holder.querySelector('[data-photo-box]').innerHTML=src?`<img src="${escapeHtml(src)}" alt="">`:'<span>No photo</span>';
    holder.querySelector('[data-photo-remove]').classList.toggle('hidden',!src)};
  show();
  holder.querySelector('[data-photo-file]').addEventListener('change',async e=>{
    const file=e.target.files[0]; if(!file) return;
    const status=holder.querySelector('[data-photo-status]'); status.textContent='Uploading photo';
    try{const {id}=await api('photo',{method:'POST',body:JSON.stringify({dataUrl:await shrinkPhoto(file)})});
      holder.dataset.photoId=id;holder.dataset.photoPath='';show();status.textContent='Photo uploaded. Save to keep it.';markProgrammeDirty()}
    catch(err){status.textContent=`Photo not uploaded: ${err.message}`}
    e.target.value='';
  });
  holder.querySelector('[data-photo-remove]').onclick=()=>{holder.dataset.photoId='';holder.dataset.photoPath='';show();markProgrammeDirty()};
}
const readPhoto=holder=>({photoId:holder.dataset.photoId||'',photoPath:holder.dataset.photoPath||''});

function renderProgrammeForm(){
  const e=data.eduhub||{};
  pf.elements.requireSessionChoice.checked=e.requireSessionChoice!==false;
  renderKeynote(e.keynote||{});
  roundBuilder.innerHTML='';(e.rounds||[]).forEach(r=>addRoundRow(r));
  if(!roundBuilder.children.length) roundBuilder.innerHTML='<p class="empty small" data-empty>No rounds yet.</p>';
  workshopBuilder.innerHTML='';(e.workshops||[]).forEach(w=>addWorkshopRow(w));
  if(!workshopBuilder.children.length) workshopBuilder.innerHTML='<p class="empty small" data-empty>No workshops yet. Add them one by one, or fill them in from the workshop booklet.</p>';
  schoolBuilder.innerHTML='';(e.schools||[]).forEach(x=>addSchoolRow(x));
  if(!schoolBuilder.children.length) schoolBuilder.innerHTML='<p class="empty small" data-empty>No schools or teams added yet.</p>';
  programmeDirty=false;$('#programme-dirty').textContent='';
}
function renderKeynote(k){
  $$('[data-k]',pf).forEach(el=>el.value=k[el.dataset.k]||'');
  photoPicker($('#keynote-photo-cell'),k);
}
const readKeynote=()=>({...Object.fromEntries($$('[data-k]',pf).map(el=>[el.dataset.k,el.value.trim()])),...readPhoto($('#keynote-photo-cell'))});

function addRoundRow(r={}){
  roundBuilder.querySelector('[data-empty]')?.remove();
  const n=roundBuilder.querySelectorAll('.round-row').length+1;
  const uid=`r${Math.random().toString(36).slice(2,8)}`;
  const row=document.createElement('div');row.className='school-row round-row';row.dataset.id=r.id||`round-${Date.now().toString(36)}${n}`;
  row.innerHTML=`<div class="field"><label for="${uid}-l">Round name</label><input id="${uid}-l" data-r="label" value="${escapeHtml(r.label||`Round ${n}`)}" maxlength="60"></div>
    <div class="field"><label for="${uid}-s">Starts</label><input id="${uid}-s" type="time" data-r="startTime" value="${escapeHtml(r.startTime||'')}"></div>
    <div class="field"><label for="${uid}-e">Finishes</label><input id="${uid}-e" type="time" data-r="endTime" value="${escapeHtml(r.endTime||'')}"></div>
    <button type="button" class="danger" data-remove-round>Remove</button>
    <div class="round-groups"><span class="muted small">Who attends:</span> ${PHASES.map(([p,n])=>`<label class="allergen-check"><input type="checkbox" data-round-phase="${p}" ${!(r.phases||[]).length||r.phases.includes(p)?'checked':''}> <span>${n} staff</span></label>`).join('')}</div>`;
  row.querySelector('[data-r=label]').addEventListener('input',refreshRoundTicks);
  row.querySelector('[data-remove-round]').onclick=()=>{if(confirm(`Remove ${row.querySelector('[data-r=label]').value}? Bookings already made keep their record, but the round will no longer be offered.`)){row.remove();refreshRoundTicks();markProgrammeDirty()}};
  roundBuilder.appendChild(row);refreshRoundTicks();return row;
}
const readRounds=()=>$$('.round-row',roundBuilder).map(r=>{
  const phases=$$('[data-round-phase]:checked',r).map(i=>i.dataset.roundPhase);
  return {id:r.dataset.id,label:r.querySelector('[data-r=label]').value.trim(),startTime:r.querySelector('[data-r=startTime]').value,endTime:r.querySelector('[data-r=endTime]').value,phases:phases.length===PHASES.length?[]:phases};
});
// Keeps each workshop's "Runs in" tick boxes in step with the rounds list.
// A workshop saved with no rounds listed runs in every round.
function refreshRoundTicks(){
  const rounds=readRounds();
  $$('.workshop-row',workshopBuilder).forEach(row=>{
    const box=row.querySelector('[data-round-ticks]');
    let current, all=false;
    if(box.dataset.init!==undefined){current=JSON.parse(box.dataset.init||'[]');all=!current.length;delete box.dataset.init}
    else current=$$('[data-round]',box).filter(i=>i.checked).map(i=>i.dataset.round).concat($$('[data-round]',box).length?[]:['*']);
    if(current.includes('*')) all=true;
    const known=new Set($$('[data-round]',box).map(i=>i.dataset.round));
    box.innerHTML=rounds.length?rounds.map(r=>`<label class="allergen-check"><input type="checkbox" data-round="${escapeHtml(r.id)}" ${all||current.includes(r.id)||(known.size&&!known.has(r.id))?'checked':''}> <span>${escapeHtml(r.label||'Round')}</span></label>`).join(''):'<span class="muted small">Add rounds above first.</span>';
  });
}
function addWorkshopRow(w={}){
  workshopBuilder.querySelector('[data-empty]')?.remove();
  const uid=`w${Math.random().toString(36).slice(2,8)}`;
  const row=document.createElement('fieldset');row.className='food-row programme-row workshop-row';row.dataset.id=w.id||'';
  row.innerHTML=`<legend>${escapeHtml(w.title||'New workshop')}</legend>
    <div class="programme-grid"><div class="photo-cell" data-photo-holder></div>
      <div class="form-grid">
        <div class="field full"><label for="${uid}-t">Workshop title</label><input id="${uid}-t" data-w="title" value="${escapeHtml(w.title||'')}" maxlength="150"></div>
        <div class="field"><label for="${uid}-n">Speaker name</label><input id="${uid}-n" data-w="speakerName" value="${escapeHtml(w.speakerName||'')}" maxlength="120"></div>
        <div class="field"><label for="${uid}-ro">Speaker role <span class="optional">(optional)</span></label><input id="${uid}-ro" data-w="speakerRole" value="${escapeHtml(w.speakerRole||'')}" maxlength="150"></div>
        <div class="field full"><label for="${uid}-d">Description</label><textarea id="${uid}-d" data-w="description" rows="5" maxlength="4000">${escapeHtml(w.description||'')}</textarea><span class="field-help">Start a line with "- " to show it as a bullet point.</span></div>
        <div class="field full"><label for="${uid}-b">About the speaker <span class="optional">(optional)</span></label><textarea id="${uid}-b" data-w="speakerBio" rows="3" maxlength="2500">${escapeHtml(w.speakerBio||'')}</textarea></div>
        <div class="field"><label for="${uid}-a">Recommended audience</label><select id="${uid}-a" data-w="recommended">${AUDIENCES.map(([v,n])=>`<option value="${v}" ${(w.recommended||'all')===v?'selected':''}>${n}</option>`).join('')}</select></div>
        <div class="field"><label for="${uid}-r">Room or area</label><input id="${uid}-r" data-w="room" value="${escapeHtml(w.room||'')}" maxlength="100"></div>
        <div class="field"><label for="${uid}-c">Places per round <span class="optional">(0 = no limit)</span></label><input id="${uid}-c" type="number" min="0" data-w="capacity" value="${escapeHtml(w.capacity||0)}"></div>
        <div class="field full"><span class="label-text">Runs in</span><div class="suitable-row" data-round-ticks data-init="${escapeHtml(JSON.stringify(w.rounds||[]))}"></div></div>
        <div class="field full"><label for="${uid}-x">Admin notes <span class="optional">(only visible to administrators)</span></label><textarea id="${uid}-x" data-w="adminNotes" rows="2" maxlength="1000">${escapeHtml(w.adminNotes||'')}</textarea></div>
      </div></div>
    <div class="food-row-footer"><span></span><div class="actions">
      <button type="button" class="ghost" data-move="-1">Move up</button><button type="button" class="ghost" data-move="1">Move down</button>
      <button type="button" class="danger" data-remove-workshop>Remove workshop</button></div></div>`;
  photoPicker(row.querySelector('[data-photo-holder]'),w);
  row.querySelector('[data-w=title]').addEventListener('input',e=>row.querySelector('legend').textContent=e.target.value||'New workshop');
  row.querySelector('[data-remove-workshop]').onclick=()=>{
    const n=data.bookings.filter(b=>(b.sessionIds||[]).some(id=>id.startsWith(`${row.dataset.id}@`))&&statusOf(b)!=='cancelled').length;
    if(confirm(`Remove "${row.querySelector('[data-w=title]').value||'this workshop'}"?${n?`\n\n${n} booking${n===1?' includes':'s include'} it. Their records keep the workshop name, but it will no longer count towards numbers.`:''}`)){row.remove();markProgrammeDirty()}
  };
  $$('[data-move]',row).forEach(b=>b.onclick=()=>{
    if(b.dataset.move<0&&row.previousElementSibling) workshopBuilder.insertBefore(row,row.previousElementSibling);
    if(b.dataset.move>0&&row.nextElementSibling) workshopBuilder.insertBefore(row.nextElementSibling,row);
    markProgrammeDirty();
  });
  workshopBuilder.appendChild(row);refreshRoundTicks();return row;
}
function readWorkshops(){
  const roundCount=readRounds().length;
  return $$('.workshop-row',workshopBuilder).map(r=>{
    const v=f=>r.querySelector(`[data-w="${f}"]`).value.trim();
    const ticked=$$('[data-round]:checked',r).map(i=>i.dataset.round);
    return {id:r.dataset.id,title:v('title'),speakerName:v('speakerName'),speakerRole:v('speakerRole'),description:v('description'),speakerBio:v('speakerBio'),
      recommended:v('recommended'),room:v('room'),capacity:Number(v('capacity'))||0,adminNotes:v('adminNotes'),
      rounds:ticked.length===roundCount?[]:ticked,...readPhoto(r.querySelector('[data-photo-holder]'))};
  });
}
function addSchoolRow(school={}){
  schoolBuilder.querySelector('[data-empty]')?.remove();
  const row=document.createElement('div');
  const uid=`s${Math.random().toString(36).slice(2,8)}`;
  row.className='school-row';row.dataset.id=school.id||'';
  row.innerHTML=`<div class="field"><label for="${uid}-n">Name</label><input id="${uid}-n" data-school-name value="${escapeHtml(school.name||'')}" maxlength="120"></div>
    <div class="field"><label for="${uid}-p">Phase</label><select id="${uid}-p" data-school-phase>${PHASES.map(([p,n])=>`<option value="${p}" ${school.phase===p?'selected':''}>${n}</option>`).join('')}</select></div>
    <button type="button" class="danger" data-remove-school>Remove</button>`;
  row.querySelector('[data-remove-school]').onclick=()=>{row.remove();markProgrammeDirty()};
  schoolBuilder.appendChild(row);return row;
}
const readSchools=()=>$$('.school-row',schoolBuilder).map(r=>({id:r.dataset.id,name:r.querySelector('[data-school-name]').value.trim(),phase:r.querySelector('[data-school-phase]').value})).filter(x=>x.name);
$('#add-school').addEventListener('click',()=>{addSchoolRow().querySelector('input').focus();markProgrammeDirty()});
$('#bulk-add-schools').addEventListener('click',()=>{
  const have=new Set(readSchools().map(x=>x.name.toLowerCase()));
  const names=$('#bulk-schools').value.split('\n').map(x=>x.trim()).filter(x=>x&&!have.has(x.toLowerCase()));
  names.forEach(n=>addSchoolRow({name:n,phase:$('#bulk-phase').value}));
  $('#bulk-schools').value='';
  if(names.length){markProgrammeDirty();message(`${names.length} added. Press Save sessions to keep them.`,'notice warn')}
});
$('#add-round').addEventListener('click',()=>{addRoundRow().querySelector('input').focus();markProgrammeDirty()});
$('#add-workshop').addEventListener('click',()=>{addWorkshopRow().querySelector('[data-w=title]').focus();markProgrammeDirty()});
$('#load-booklet').addEventListener('click',()=>{
  const B=WORKSHOP_BOOKLET_2027;
  const have=new Set(readWorkshops().map(w=>w.title.toLowerCase()));
  const toAdd=B.workshops.filter(w=>!have.has(w.title.toLowerCase()));
  const current=readRounds(), sameRounds=current.length===B.rounds.length&&current.every((r,i)=>r.startTime===B.rounds[i].startTime&&r.endTime===B.rounds[i].endTime);
  let needRounds=!current.length;
  if(current.length&&!sameRounds) needRounds=confirm(`Replace the ${current.length} round${current.length===1?'':'s'} already here with the four rounds from the booklet?\n\n${B.rounds.map(r=>`${r.label}: ${r.startTime} to ${r.endTime}`).join('\n')}\n\nPress Cancel to keep the rounds you have.`);
  const needKeynote=!$('#k-name').value.trim();
  if(!toAdd.length&&!needRounds&&!needKeynote){message('Everything from the workshop booklet is already here.');return}
  if(!confirm(`Fill in from the workshop booklet?\n\n${[needKeynote?'The keynote (Graham Allcott)':'',needRounds?`${B.rounds.length} workshop rounds`:'',toAdd.length?`${toAdd.length} workshops with speaker photos`:''].filter(Boolean).join('\n')}\n\nPlease check the details, add rooms, then press Save sessions.`)) return;
  if(needKeynote) renderKeynote(B.keynote);
  if(needRounds){roundBuilder.innerHTML='';B.rounds.forEach(r=>addRoundRow(r))}
  toAdd.forEach(w=>addWorkshopRow(w));
  markProgrammeDirty();
  message('Details added from the workshop booklet. They are not saved yet. Please check them, add rooms, then press Save sessions.','notice warn');
});
$('#preview-programme').addEventListener('click',()=>{
  if(programmeDirty) alert('The preview shows the saved settings. Save your changes first to see them in the preview.');
  window.open('/eduhub/?preview=1','_blank','noopener');
});
pf.addEventListener('submit',async e=>{
  e.preventDefault();
  const workshops=readWorkshops();
  const untitled=workshops.find(x=>!x.title&&(x.description||x.speakerName));
  if(untitled){message('One of the workshops has details but no title. Please add a title or remove it.','notice error');return}
  const rounds=readRounds();
  if(workshops.some(w=>w.title)&&!rounds.length){message('Please add at least one round, so staff can book the workshops.','notice error');return}
  const noGroup=$$('.round-row',roundBuilder).find(r=>!$$('[data-round-phase]:checked',r).length);
  if(noGroup){message(`Please tick at least one group for ${noGroup.querySelector('[data-r=label]').value||'each round'}.`,'notice error');return}
  const btn=pf.querySelector('button[type=submit]');btn.disabled=true;
  try{
    await api('eduhub',{method:'POST',body:JSON.stringify({section:'programme',keynote:readKeynote(),rounds,workshops:workshops.filter(x=>x.title),schools:readSchools(),requireSessionChoice:pf.elements.requireSessionChoice.checked})});
    programmeDirty=false;await refresh({keepProgrammeForm:false});message('Sessions saved.');
  }catch(err){message(`Sessions were not saved: ${err.message}`,'notice error')}
  finally{btn.disabled=false}
});
function renderSessionSummary(){
  const sessions=data.eduhub.sessions||[];
  if(!sessions.length){$('#session-summary').innerHTML='<p class="muted">No workshops yet.</p>';return}
  const count=id=>data.bookings.filter(b=>b.itemId===EDUHUB_ID&&statusOf(b)==='booked'&&(b.sessionIds||[]).includes(id)).length;
  const groupsOf=x=>(x.roundPhases||[]).length?` (${x.roundPhases.map(p=>(PHASES.find(y=>y[0]===p)||[])[1]).join(', ')})`:'';
  $('#session-summary').innerHTML=slotsOf(sessions).map(slot=>`<h3>${escapeHtml(slot.label)}${escapeHtml(groupsOf(slot.items[0]))}</h3><div class="table-wrap"><table class="compact"><thead><tr><th>Workshop</th><th>Room or area</th><th>Booked</th><th></th></tr></thead><tbody>${slot.items.map(x=>{const n=count(x.id);return `<tr><td><strong>${escapeHtml(x.title)}</strong>${x.speakerName?`<br><span class="muted">${escapeHtml(x.speakerName)}</span>`:''}</td><td>${escapeHtml(x.room||'')}</td><td>${n}${x.capacity?` of ${x.capacity}`:''}${x.capacity&&n>=x.capacity?' <span class="status-pill waiting">Full</span>':''}</td><td><a class="button secondary small-button" href="/api/export-bookings?view=register&amp;session=${encodeURIComponent(x.id)}">Register (CSV)</a></td></tr>`}).join('')}</tbody></table></div>`).join('');
}

boot();
