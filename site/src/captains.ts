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

// A photo is either a filename (in /images, no extension) or an object with
// optional framing controls: `pos` = CSS object-position (e.g. 'left center',
// 'center top') to keep the subject in frame; `offset` = vertical nudge for a
// bottom-strip photo (e.g. '-16px' to move up, '64px' to move down).
export type Photo = string | { src: string; pos?: string; offset?: string };

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
  photos: Photo[];        // filenames in /images/ (no .jpg ext), or {src,pos,offset}
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
    photos: [
      'charlie-5',                              // selfie, clear face -> lead + crew card
      { src: 'charlie-2', pos: 'left center' }, // pilot/Cessna, Charlie is on the left
      'charlie-1',                              // sailing (Bacardi shot)
      'charlie-6',                              // bow, orange vest, skyline
      'charlie-4',                              // sailboat with crew
    ],
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
    bio: "Captain Joseph Crulcich is a USCG-licensed mariner with 15+ years of experience spanning commercial shipping, yacht deliveries, and luxury charters. A Chicago native who grew up boating on Lake Michigan, he started at Shoreline Sightseeing before spending nine years with Military Sealift Command, rising to Second Mate. He's sailed all seven seas, visited 55+ countries, and transited the Panama, Suez, and Kiel Canals. He currently serves as Third Mate with Grand River Navigation on the Great Lakes, holds a 500-Ton Master License and TOAR, and is pursuing his 1,600-Ton Master License. Since 2015 he's also worked as a yacht and charter captain, and since 2022 as a delivery captain with Spring Brook Marine. Guests know him for pairing top-tier seamanship with an easygoing, hospitality-first approach making every trip safe, professional, and genuinely fun.",
    photos: [
      'joseph-1',
      { src: 'joseph-2', pos: 'left center' }, // selfie, Joseph is front-left
      'joseph-6',                              // standing shot, swapped into the stack
      'joseph-4',
      'joseph-5',
      'joseph-3',                              // helm-with-kid, swapped out of the stack
      'joseph-7',
    ],
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
    photos: [
      'luis-1', 'luis-2', 'luis-3',
      { src: 'luis-4', offset: '-16px' }, // nudge up slightly
      'luis-5',
      { src: 'luis-6', offset: '64px' },  // scoot down
    ],
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
