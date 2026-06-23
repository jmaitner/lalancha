// Single source of truth for captain profiles.
// Each captain gets a page at /captains/[slug].

export interface CaptainStat {
  label: string;
  value: string;
}

export interface Captain {
  slug: string;
  name: string;           // full legal name
  handle: string;         // "Captain Jake" — primary display name
  tagline: string;        // one punchy line under the hero name
  bio: string;            // warm paragraph bio, 3-5 sentences
  photos: string[];       // 5+ image filenames in /images/ (no .jpg extension)
                          // order matters: [0-2] = hero stack, [3+] = bottom strip
  license: string;        // e.g. "USCG 50-ton Master"
  years: string;          // e.g. "8 years on Lake Michigan"
  homeWaters: string;
  certs: string[];
  favoriteRoute: string;
  extraStats?: CaptainStat[];
}

export const captains: Captain[] = [
  {
    slug: 'sample-captain',
    name: 'Captain Name',
    handle: 'Captain Name',
    tagline: 'Eight years on Lake Michigan and still picks the Playpen every time.',
    bio: 'Replace this with the real bio. Keep it warm and specific: where they grew up on the water, how long they have been doing this, what they bring to a charter day. A sentence or two about their vibe. Guests are hiring a person, not a credential.',
    photos: ['quarters9', 'quarters3', 'quarters12', 'quarters20', 'img_2080'],
    license: 'USCG 50-ton Master',
    years: '8 years on Lake Michigan',
    homeWaters: 'Lake Michigan',
    certs: ['CPR / First Aid', 'STCW Basic Safety Training'],
    favoriteRoute: 'The Playpen',
    extraStats: [
      // add more rows here as needed, e.g.:
      // { label: 'Home harbor', value: 'Diversey Harbor' },
    ],
  },
];
