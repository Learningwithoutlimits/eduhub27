// Shared by the public site, the admin dashboard and the Netlify Functions
// (esbuild bundles this file into each function that imports it).

// The 14 allergens that UK food law requires caterers to declare.
// Codes match the supplied EduHub 2027 allergen matrix.
export const ALLERGENS = [
  { code: 'GL', name: 'Gluten', full: 'Cereals containing gluten' },
  { code: 'EG', name: 'Eggs', full: 'Eggs' },
  { code: 'CE', name: 'Celery', full: 'Celery' },
  { code: 'CR', name: 'Crustaceans', full: 'Crustaceans' },
  { code: 'FI', name: 'Fish', full: 'Fish' },
  { code: 'LU', name: 'Lupin', full: 'Lupin' },
  { code: 'DA', name: 'Milk', full: 'Milk (dairy)' },
  { code: 'MO', name: 'Molluscs', full: 'Molluscs' },
  { code: 'MU', name: 'Mustard', full: 'Mustard' },
  { code: 'PN', name: 'Peanuts', full: 'Peanuts' },
  { code: 'SE', name: 'Sesame', full: 'Sesame' },
  { code: 'SO', name: 'Soya', full: 'Soybeans' },
  { code: 'SU', name: 'Sulphites', full: 'Sulphur dioxide and sulphites' },
  { code: 'TN', name: 'Tree nuts', full: 'Tree nuts' }
];
export const ALLERGEN_CODES = ALLERGENS.map(a => a.code);

export const SUITABLE_FOR = [
  { code: 'vegetarian', name: 'Vegetarian' },
  { code: 'vegan', name: 'Vegan' },
  { code: 'halal', name: 'Halal' },
  { code: 'gluten-free', name: 'Gluten free' }
];
export const SUITABLE_CODES = SUITABLE_FOR.map(s => s.code);

// Plain-English summary of one food choice, e.g. "Gluten (wheat), Eggs".
export function allergenSummary(choice) {
  const codes = Array.isArray(choice?.allergens) ? choice.allergens : [];
  if (!codes.length) return '';
  return ALLERGENS.filter(a => codes.includes(a.code)).map(a => {
    if (a.code === 'GL' && choice.cerealTypes) return `${a.name} (${choice.cerealTypes.toLowerCase()})`;
    if (a.code === 'TN' && choice.treeNutTypes) return `${a.name} (${choice.treeNutTypes.toLowerCase()})`;
    return a.name;
  }).join(', ');
}

// Menu transcribed from documents/EduHub-2027-Allergen-Matrix.pdf.
// The admin dashboard offers this as a starting point only. Nothing is
// saved until an administrator reviews the rows and presses Save.
export const MATRIX_MENU_2027 = [
  { group: 'Hot meals', name: 'Quorn Sausage Casserole', allergens: ['GL'], cerealTypes: 'Wheat' },
  { group: 'Hot meals', name: 'Quorn Chilli and Rice', allergens: ['GL', 'EG'], cerealTypes: 'Barley' },
  { group: 'Hot meals', name: 'Butter Quorn Curry and Rice', allergens: ['GL', 'TN'], cerealTypes: 'Wheat', treeNutTypes: 'Almond, Cashew' },
  { group: 'Grab bags', name: 'Mexican Bean Sandwich', allergens: ['GL'], cerealTypes: 'Wheat, Barley' },
  { group: 'Grab bags', name: 'Pesto, Mozzarella, Tomato and Rocket Sandwich', allergens: ['GL', 'EG', 'DA'], cerealTypes: 'Wheat' },
  { group: 'Grab bags', name: 'Chicken Mayo Sandwich', allergens: ['GL', 'EG'], cerealTypes: 'Wheat', suitableFor: ['halal'] },
  { group: 'Grab bags', name: 'Classic Ham Salad Sandwich', allergens: ['GL'], cerealTypes: 'Wheat' },
  { group: 'Grab bags', name: 'Tuna Mayo Sandwich', allergens: ['GL', 'EG', 'FI'], cerealTypes: 'Wheat' },
  { group: 'Grab bags', name: 'Egg and Cress Sandwich', allergens: ['EG'], suitableFor: ['gluten-free'] },
  { group: 'Grab bags', name: 'Chicken Salad Sandwich', allergens: ['EG'], suitableFor: ['gluten-free'] }
];
