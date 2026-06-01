// ── La Lancha site config ───────────────────────────────────────────────
// The live Apps Script web-app endpoint (same one the backend deployed).
export const ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzXyymV1KNVGmDzu9T-Lemef7Qrfpq6OES4ugP3SGvEi90tAJ0xF2twGwAyKP6H1Iue/exec';

export const BUSINESS = 'La Lancha';
export const BOAT = 'Quarters';
export const DOCK = 'Diversey Harbor · K-Dock, Slip 8';

// The three fixed daily blocks (value = what the backend expects).
export const BLOCKS = [
  { id: 'morning',   label: 'Morning',   time: '10:00 AM – 2:00 PM' },
  { id: 'afternoon', label: 'Afternoon', time: '2:30 PM – 6:30 PM' },
  { id: 'night',     label: 'Night',     time: '7:00 PM – 11:00 PM' },
] as const;

export const DEFAULT_BLOCK_PRICE = 880; // standard price per time segment (fallback if pricing fetch fails)

// Capacity (USCG bareboat max is 12 passengers).
export const MAX_PARTY = 12;
