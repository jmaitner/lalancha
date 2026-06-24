// Single source of truth for captain profiles.
// Each captain object generates a page at /captains/[slug].
//
// STATUS:
//   - credentials .... REAL (from Luis, June 2026)
//   - photos ......... REAL (converted from /Captain images/, June 2026)
//   - bios ........... REAL
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
    bio: "Charlie is the racer of the crew, which might lead you to expect fast and loose. He's the opposite: a rules guy who knows exactly how a boat works and exactly how to keep you safe. He's also in high demand, so he isn't always free. On the big race weekends, the Chicago to Mackinac, the Queen's Cup, the Clipper Cup, don't even bother calling, he won't answer. Catch him on an off week, though, and he might pick up on the first ring, half convinced you're a client from his day job.",
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
    tagline: 'Plays anything, docks anywhere.',
    bio: "Connor is a rockstar who moonlights as a boat captain. A multitalented musician at home across genres and instruments, he brings that same range to the water. He's a natural teacher with a steady hand: ask him to show you something and he'll gladly walk you through it, because he wants everyone around him to succeed. No docking situation or unfamiliar boat seems to rattle him. When he isn't out with us, he's whipping around the city on the tour boats.",
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
    tagline: 'Freighters, Tankers, and Quarters',
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
      '500 Ton Master',
      'Master 100 Near Coastal',
      'First Class Pilotage',
      'FCC MROP License',
      'Advanced First Aid',
      'CPR & AED',
    ],
  },
  {
    slug: 'luis',
    name: 'Luis G. Vecchio',
    handle: 'Captain Luis',
    tagline: 'Heard you want to do boat stuff?',
    bio: "Luis has been on the water since he was a kid: little sailboats and speedboats, then driving at wakeboard clinics, which turned into pro/am tournaments, which turned into racing big boats out of Muskegon and sailing even bigger ones across oceans. He holds a 100-Ton Great Lakes Master and can run a six-pack charter for groups of six or fewer. He's done a little of everything out there, from the tour boats to windsurfing, and he used to be able to do a backflip on a wakeboard, technically it was a \"tantrum\", but either way, those days are behind him. His dream has been the same since he was young, and it's a simple one: own a marina. He's not there yet, so for now he's working on convincing the banks he knows enough about boats and real estate to pull it off. He's also got a day job. It's very boring, he won't talk about it, but it comes with insurance, so.",
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
