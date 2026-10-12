
const $=(s,e=document)=>e.querySelector(s), $$=(s,e=document)=>[...e.querySelectorAll(s)];
let data={courses:[],bookings:[],eduhub:{}};
const escapeHtml=str=>String(str??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmt=v=>v?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(v+'T12:00:00')):'—';
const message=(text,type='notice')=>{$('#admin-message').innerHTML=text?`<p class="${type}">${escapeHtml(text)}</p>`:''};

async function api(path,opts={}){
  const res=await fetch('/api/'+path,{headers:{'content-type':'application/json',...(opts.headers||{})},...opts});
  if(res.status===401){showLogin();throw new Error('Please sign in again.')}
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
  e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;
  try{await api('login',{method:'POST',body:JSON.stringify({password:e.currentTarget.password.value})});$('#login-message').innerHTML='';showAdmin();await refresh()}
  catch(err){$('#login-message').innerHTML=`<p class="notice error">${escapeHtml(err.message)}</p>`}
  finally{btn.disabled=false}
});
$('#logout').addEventListener('click',async()=>{await api('logout',{method:'POST'});showLogin()});
$$('.side-nav [data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
function switchView(name){
  $$('.admin-section').forEach(s=>s.classList.add('hidden'));$('#'+name+'-view').classList.remove('hidden');
  $$('.side-nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  $('#view-title').textContent={overview:'Overview',courses:'Professional Learning',eduhub:'Events',bookings:'Bookings'}[name];
}
async function refresh(){
  data=await api('admin-data');renderAll();
}
function renderAll(){
  $('#stat-published').textContent=data.courses.filter(c=>c.status==='published').length;
  $('#stat-drafts').textContent=data.courses.filter(c=>c.status==='draft').length;
  $('#stat-course-bookings').textContent=data.bookings.filter(b=>b.itemType==='course').length;
  $('#stat-eduhub-bookings').textContent=data.bookings.filter(b=>b.itemType==='eduhub').length;
  $('#courses-table').innerHTML=data.courses.length?data.courses.map(c=>`<tr><td><strong>${escapeHtml(c.title)}</strong><br><span class="muted">${escapeHtml(c.audience||'')}</span></td><td>${fmt(c.date)}</td><td>${escapeHtml(c.status)}</td><td>${c.bookingOpen===false?'Closed':'Open'}</td><td>${escapeHtml(c.capacity||'—')}</td><td><div class="actions"><button class="ghost preview-course" data-id="${c.id}">Preview</button><button class="ghost edit-course" data-id="${c.id}">Edit</button><button class="ghost duplicate-course" data-id="${c.id}">Duplicate</button><button class="danger delete-course" data-id="${c.id}">Delete</button></div></td></tr>`).join(''):'<tr><td colspan="6">No opportunities have been created yet.</td></tr>';
  bindCourseActions();
  const ef=$('#eduhub-form');
  Object.entries(data.eduhub||{}).forEach(([k,v])=>{
    if(!ef.elements[k]) return;
    if(k==='askDietary' && ef.elements[k].type==='checkbox') ef.elements[k].checked=Boolean(v);
    else ef.elements[k].value=typeof v==='boolean'?String(v):v??'';
  });
  foodBuilder.innerHTML='';
  (Array.isArray(data.eduhub?.foodChoices)?data.eduhub.foodChoices:[]).forEach(addFoodChoiceRow);
  renderBookings();
}
function renderBookings(filter=''){
  const q=filter.toLowerCase();
  const rows=data.bookings.filter(b=>JSON.stringify(b).toLowerCase().includes(q));
  $('#bookings-table').innerHTML=rows.length?rows.map(b=>`<tr><td>${new Date(b.createdAt).toLocaleString('en-GB')}</td><td><strong>${escapeHtml(b.firstName)} ${escapeHtml(b.lastName)}</strong><br>${escapeHtml(b.jobTitle||'')}</td><td>${escapeHtml(b.organisation)}</td><td>${escapeHtml(b.itemTitle)}</td><td>${b.waitingList?'Waiting list':'Booked'}</td><td>${escapeHtml(b.email)}<br>${escapeHtml(b.telephone||'')}</td></tr>`).join(''):'<tr><td colspan="6">No matching bookings.</td></tr>';
}
$('#booking-search').addEventListener('input',e=>renderBookings(e.target.value));

const modal=$('#course-modal'), cf=$('#course-form');
const foodBuilder=$('#food-choice-builder');
function addFoodChoiceRow(choice=''){
  const row=document.createElement('div');
  row.className='session-row food-choice-row';
  row.innerHTML=`<div class="field" style="grid-column:1/-2"><label>Choice</label><input data-food-choice value="${escapeHtml(choice)}" placeholder="e.g. Chicken option"></div><button type="button" class="danger remove-food-choice">Remove</button>`;
  row.querySelector('.remove-food-choice').onclick=()=>row.remove();
  foodBuilder.appendChild(row);
}
function readFoodChoices(){return [...foodBuilder.querySelectorAll('[data-food-choice]')].map(i=>i.value.trim()).filter(Boolean)}
$('#add-food-choice').addEventListener('click',()=>addFoodChoiceRow(''));
const sessionBuilder=$('#session-builder');

function addSessionRow(session={}){
  const row=document.createElement('div');
  row.className='session-row';
  row.innerHTML=`
    <div class="field"><label>Session name</label><input data-session="label" value="${escapeHtml(session.label||'')}" placeholder="e.g. Session 1"></div>
    <div class="field"><label>Date</label><input data-session="date" type="date" value="${escapeHtml(session.date||'')}"></div>
    <div class="field"><label>Time</label><input data-session="time" value="${escapeHtml(session.time||'')}" placeholder="e.g. 09:30–15:30"></div>
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
$('[data-close-course]').addEventListener('click',()=>modal.classList.remove('open'));
function openCourse(course={}){
  cf.reset();
  Object.entries(course).forEach(([k,v])=>{
    if(!cf.elements[k]) return;
    if(k==='askDietary' && cf.elements[k].type==='checkbox') cf.elements[k].checked=Boolean(v);
    else cf.elements[k].value=typeof v==='boolean'?String(v):v??'';
  });
  sessionBuilder.innerHTML='';
  const sessions=Array.isArray(course.sessions)&&course.sessions.length?course.sessions:
    ((course.date||course.time)?[{label:'Session 1',date:course.date||'',time:course.time||''}]:[{label:'Session 1'}]);
  sessions.forEach(addSessionRow);
  $('#course-modal-title').textContent=course.id?'Edit opportunity':'Add opportunity';modal.classList.add('open');
}
function bindCourseActions(){
  $$('.preview-course').forEach(b=>b.onclick=()=>window.open(`/preview.html?type=course&id=${encodeURIComponent(b.dataset.id)}`,'_blank'));
  $$('.edit-course').forEach(b=>b.onclick=()=>openCourse(data.courses.find(c=>c.id===b.dataset.id)));
  $$('.duplicate-course').forEach(b=>b.onclick=()=>{const c={...data.courses.find(c=>c.id===b.dataset.id),id:'',title:data.courses.find(c=>c.id===b.dataset.id).title+' (copy)',status:'draft'};openCourse(c)});
  $$('.delete-course').forEach(b=>b.onclick=async()=>{if(confirm('Delete this opportunity? Existing bookings will remain in the bookings list.')){await api('course',{method:'DELETE',body:JSON.stringify({id:b.dataset.id})});await refresh()}});
}
cf.addEventListener('submit',async e=>{
  e.preventDefault();
  const obj=Object.fromEntries(new FormData(cf).entries());
  obj.bookingOpen=obj.bookingOpen==='true';
  obj.capacity=Number(obj.capacity)||0;
  obj.askDietary=cf.elements.askDietary.checked;
  obj.sessions=readSessions();
  obj.date=obj.sessions[0]?.date||'';
  obj.time=obj.sessions[0]?.time||'';
  try{
    const result=await api('course',{method:'POST',body:JSON.stringify(obj)});
    modal.classList.remove('open');
    message('Opportunity saved successfully.');
    if(result?.item){
      const i=data.courses.findIndex(c=>c.id===result.item.id);
      if(i>=0) data.courses[i]=result.item; else data.courses.unshift(result.item);
      renderAll();
    }
    await refresh();
  }catch(err){
    message(`The opportunity was not saved: ${err.message}`,'notice error');
  }
});
$('#eduhub-form').addEventListener('submit',async e=>{
  e.preventDefault();const obj=Object.fromEntries(new FormData(e.currentTarget).entries());obj.bookingOpen=obj.bookingOpen==='true';obj.capacity=Number(obj.capacity)||0;obj.askDietary=e.currentTarget.elements.askDietary.checked;obj.foodChoices=readFoodChoices();
  try{await api('eduhub',{method:'POST',body:JSON.stringify(obj)});message('EduHub settings saved.');await refresh()}catch(err){message(err.message,'notice error')}
});
$('#preview-eduhub')?.addEventListener('click',()=>window.open('/eduhub-preview.html','_blank'));
boot();
