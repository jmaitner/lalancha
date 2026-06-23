// Single source of truth for captain profiles.
// Each captain object generates a page at /captains/[slug].
//
// STATUS:
//   - credentials .... REAL (from Luis, June 2026)
//   - photos ......... REAL (converted from /Captain images/, June 2026)
//   - bios ........... PLACEHOLDER — replace with each captain's real bio
//
// `credentials` is a flat list of licenses + certifications shown as badges,
// in the order listed. `extraStats` is optional key/value rows (years on the
// water, home waters, etc.) if we add them later.

export interface CaptainStat {
  label: string;
  value: string;
}

export interface Captain {
  slug: string;
  name: string;           // full name (shown big in hero)
  handle: string;         // display name used in copy, e.g. "Captain Charlie"
  tagline: string;        // one punchy line under the hero name
  bio: string;            // warm paragraph bio, 3-5 sentences
  photos: string[];       // 5+ image filenames in /images/ (no .jpg extension)
                          // order matters: [0-2] = hero stack, [3+] = bottom strip
  credentials: string[];  // licenses + certifications, shown as badges
  extraStats?: CaptainStat[];
}

export const captains: Captain[] = [
  {
    slug: 'charlie',
    name: 'Charlie',
    handle: 'Captain Charlie',
    tagline: 'The captain who makes the whole day feel easy.',
    // PLACEHOLDER bio — replace with Charlie's real bio.
    bio: 'Placeholder copy. Charlie is the captain you want when you want the day to just flow. Easygoing, quick with a story, and dialed into where the good light and calm water are on any given afternoon. He treats every charter like he is showing friends his favorite stretch of the lake.',
    photos: ['charlie-1', 'charlie-2', 'charlie-3', 'charlie-4'],
    credentials: [
      'Master 100 Great Lakes',
      'FCC MROP License',
      'Advanced First Aid',
      'CPR & AED',
      'Stop the Bleed',
      'Sailing Endorsements',
    ],
  },
  {
    slug: 'connor',
    name: 'Connor Bernhard',
    handle: 'Captain Connor',
    tagline: 'Knows the lakefront cold, from quiet Burnham to a packed Playpen.',
    // PLACEHOLDER bio — replace with Connor's real bio.
    bio: 'Placeholder copy. Connor has spent years on Lake Michigan and knows the lakefront cold, from the calmest corners of Burnham to the busiest afternoon at the Playpen. He runs a relaxed, safety-first deck and has a knack for putting first-timers at ease. Ask him for the best golden-hour spot and he is already steering toward it.',
    photos: ['connor-1', 'connor-2', 'connor-3', 'connor-4', 'connor-5', 'connor-6'],
    credentials: [
      'Master 100 Great Lakes',
      'FCC MROP License',
      'Advanced First Aid',
      'CPR & AED',
      'Stop the Bleed',
    ],
  },
  {
    slug: 'joseph',
    name: 'Joseph',
    handle: 'Captain Joseph',
    tagline: 'Steady hands, quiet water, perfect timing.',
    // PLACEHOLDER bio — replace with Joseph's real bio.
    bio: 'Placeholder copy. Joseph brings a steady hand and a deep love of the water to every trip. He is happiest finding the quiet pockets of the lakefront and timing the skyline just right. Calm, capable, and always thinking a step ahead so your crew can kick back.',
    photos: ['joseph-1', 'joseph-2', 'joseph-3', 'joseph-4', 'joseph-5', 'joseph-6', 'joseph-7'],
    credentials: [
      '1600 Ton Master',
      'Master 100 Near Coastal',
      'First Class Pilotage',
      'FCC MROP License',
      'Advanced First Aid',
      'CPR & AED',
    ],
  },
  {
    slug: 'luis',
    name: 'Luis Vecchio',
    handle: 'Captain Luis',
    tagline: 'The owner, the operator, and the guy who started it all.',
    // PLACEHOLDER bio — replace with Luis's real bio.
    bio: 'Placeholder copy. Luis is the owner and operator of lancha boat and the captain who started it all. He built Quarters into a private charter you can actually relax on, and he still loves nothing more than a full boat and a flat lake. He runs every trip with care, good humor, and an eye for the perfect spot.',
    photos: ['luis-1', 'luis-2', 'luis-3', 'luis-4', 'luis-5', 'luis-6'],
    credentials: [
      'Master 100 Great Lakes',
      'OUPV Near Coastal',
      'IYT Yachtmaster Coastal',
      'IYT International Crew',
      'FCC MROP License',
      'Stop the Bleed',
      'Advanced First Aid',
      'CPR & AED',
      'Red Cross Water Safety Ambassador',
    ],
  },
];
