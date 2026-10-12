
const $ = s => document.querySelector(s);
const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[c]));
const fmtDate = value => value
  ? new Intl.DateTimeFormat('en-GB',{dateStyle:'full'}).format(new Date(value+'T12:00:00'))
  : 'Date to be confirmed';

async function loadEduhub(){
  try{
    const res = await fetch('/api/public-data',{cache:'no-store'});
    if(!res.ok) throw new Error('Unable to load EduHub details.');
    const data = await res.json();
    const e = data.eduhub || {};

    $('#edu-title').textContent = e.title || 'EduHub 2027: Better Together';
    $('#edu-description').textContent = e.description || 'Our Trust-wide professional learning event for colleagues across Learning Without Limits Academy Trust.';
    $('#edu-date').textContent = fmtDate(e.date || '2027-01-05');
    $('#side-date').textContent = fmtDate(e.date || '2027-01-05');

    const time = e.time || 'To be confirmed';
    $('#edu-time').textContent = time;
    $('#side-time').textContent = e.time ? time : 'Time to be confirmed';

    const venue = e.venue || 'Babington Academy';
    $('#edu-venue').textContent = venue;
    $('#side-venue').textContent = venue;

    const choices = Array.isArray(e.foodChoices) ? e.foodChoices : [];
    if(choices.length){
      $('#previewFood').innerHTML =
        '<option value="">Please choose</option>' +
        choices.map(choice=>`<option>${esc(choice)}</option>`).join('');
      $('#preview-food-field').classList.remove('hidden');
    }else{
      $('#previewFood').innerHTML = '<option>No food choices have been added yet</option>';
    }

    $('#preview-dietary-field').classList.toggle('hidden', !Boolean(e.askDietary));
  }catch(err){
    $('#previewFood').innerHTML = '<option>Food choices unavailable</option>';
  }
}

$('#preview-submit').addEventListener('click',()=>{
  $('#preview-submit-message').textContent =
    'This is a preview only. When EduHub bookings open, this button will submit the staff registration.';
});

loadEduhub();
