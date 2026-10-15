// Food choice radio buttons with allergens, shared by the staff booking form
// and the speaker lunch form.
import { allergenSummary, SUITABLE_FOR } from './allergens.js';

export const NO_FOOD = 'no-food';
const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function foodOptionHtml(choice){
  const summary = allergenSummary(choice);
  const allergens = summary
    ? `<span class="food-allergens"><strong>Contains:</strong> ${esc(summary)}</span>`
    : choice.allergensConfirmed
      ? '<span class="food-allergens">Contains none of the 14 main allergens</span>'
      : '<span class="food-allergens">Please check the allergen matrix for this option</span>';
  const tags = (choice.suitableFor || []).map(code => SUITABLE_FOR.find(s => s.code === code)?.name).filter(Boolean);
  return `<label class="food-option">
    <input type="radio" name="foodChoiceId" value="${esc(choice.id)}" required>
    <span class="food-option-body">
      <span class="food-name">${esc(choice.name)}</span>
      ${tags.length ? `<span class="food-tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</span>` : ''}
      ${choice.description ? `<span class="food-description">${esc(choice.description)}</span>` : ''}
      ${allergens}
    </span>
  </label>`;
}

// Returns '' when there is no menu yet.
export function foodOptionsHtml(eduhub){
  const choices = Array.isArray(eduhub.foodChoices) ? eduhub.foodChoices : [];
  if(!choices.length) return '';
  const groups = [];
  for(const c of choices){
    const name = c.group || '';
    let g = groups.find(x => x.name === name);
    if(!g) groups.push(g = { name, items: [] });
    g.items.push(c);
  }
  let html = groups.map(g => `
    ${g.name ? `<p class="food-group">${esc(g.name)}</p>` : ''}
    ${g.items.map(foodOptionHtml).join('')}`).join('');
  if(eduhub.allowNoFood){
    html += `<label class="food-option"><input type="radio" name="foodChoiceId" value="${NO_FOOD}" required>
      <span class="food-option-body"><span class="food-name">I do not need food</span></span></label>`;
  }
  return html;
}
