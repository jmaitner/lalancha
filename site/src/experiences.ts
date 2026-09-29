// ── Experiences: crewed trips we run, plus boat relocation ─────────────────
// The words live here. The PRICES live in the Operations sheet (Experiences
// tab) and the page fetches them live; the numbers below are only the fallback
// if that fetch fails. Each `legs` id must match an ID in that tab and in
// CONFIG.EXPERIENCES in apps-script/Code.gs.

export type TimeMode = 'pick' | 'sunset' | 'shuttle' | 'none';

export interface Experience {
  slug: string;            // form value + card anchor
  title: string;
  kicker: string;          // small line above the title
  tagline: string;
  body: string[];          // paragraphs
  bullets: string[];
  photo: string;           // /images filename
  legs: string[];          // sheet IDs this card books
  time: TimeMode;
  fallback: Record<string, { price: number; peakPrice?: number; peakDays?: string[]; hours?: number }>;
  priceNote?: string;      // shown next to the price
  passengers: boolean;     // false = no party size (relocation)
}

// Sunset cruise pushes off this long before that day's sunset.
export const SUNSET_LEAD_MIN = 90;

export const experiences: Experience[] = [
  {
    slug: 'architecture-tour',
    kicker: 'About 3.5 hours · Private',
    title: 'Lake & River Architecture Tour',
    tagline: 'The classic river tour, plus the lakefront the big boats never see.',
    body: [
      "Most architecture tours start downtown. Ours starts at Diversey and runs south along the Lincoln Park lakefront and past the Playpen before we ever reach the river. Then it's the full river tour, through the locks and back out again, so you hit them twice.",
      "If time allows, we swing south for a quick pass by Monroe Harbor before heading home. Kenny, a tour guide with a decade of stories about this city, does the talking. Luis drives. You and your friends bring the drinks.",
    ],
    bullets: [
      'Your group only, no crowded deck of strangers',
      'Kenny guiding, Luis at the helm',
      'Through the Chicago River locks twice',
      'Bring your own food, drinks, and playlist',
      'Fuel included. Start time is flexible.',
    ],
    photo: 'img_2523',
    legs: ['architecture-tour'],
    time: 'pick',
    fallback: { 'architecture-tour': { price: 750, hours: 3.5 } },
    priceNote: 'for the boat',
    passengers: true,
  },
  {
    slug: 'sunset-cruise',
    kicker: 'About 2.5 hours · Timed to the sun',
    title: 'Sunset Cruise',
    tagline: 'Golden hour on the lake, then the skyline lights up behind you.',
    body: [
      "We push off about 90 minutes before sunset, so you get golden hour on open water, the sun dropping behind the skyline, and the city lights coming on for the ride home. You don't have to look anything up. Pick a date and we set the time to that night's sunset.",
    ],
    bullets: [
      'Start time set to that night\'s sunset',
      'Luis at the helm, fuel included',
      'Bring your own food, drinks, and playlist',
      'Best deal on the boat Sunday through Wednesday',
    ],
    photo: 'img_2544',
    legs: ['sunset-cruise'],
    time: 'sunset',
    fallback: { 'sunset-cruise': { price: 400, peakPrice: 600, peakDays: ['Thu', 'Fri', 'Sat'], hours: 2.5 } },
    priceNote: 'for the boat',
    passengers: true,
  },
  {
    slug: 'soldier-field-shuttle',
    kicker: 'Game days & concerts',
    title: 'Soldier Field & Northerly Island Shuttle',
    tagline: 'Skip the traffic. Arrive by boat.',
    body: [
      "We pick you up at Diversey Harbor and drop you at Burnham Harbor, a short walk from Soldier Field and the concerts on Northerly Island. The pregame happens on the way down.",
      "The ride home costs more because it's the one everybody wants. Everyone else is stuck in the parking lot or staring at rideshare surge pricing, and there's only one pickup window after the final whistle or the encore. You'll be on the water.",
    ],
    bullets: [
      'Ride there, ride back, or both',
      'Luis at the helm, fuel included',
      'Bring your own food and drinks, tailgate on the water',
      'Soldier Field games and Northerly Island concerts',
      'Tell us the event and we plan around it',
    ],
    photo: 'quarters15',
    legs: ['shuttle-there', 'shuttle-back'],
    time: 'shuttle',
    fallback: {
      'shuttle-there': { price: 350, hours: 1.5 },
      'shuttle-back': { price: 550, hours: 2 },
    },
    passengers: true,
  },
  {
    slug: 'relocation',
    kicker: 'For boat owners',
    title: 'Boat Relocation',
    tagline: 'Need your boat moved? Luis will run it.',
    body: [
      "Spring launch, a move to winter storage, a new slip, or a boat you just bought across the lake. We run it from any harbor to any marina in Chicagoland for one flat price, plus rideshare to and from the boat.",
      "If it isn't big enough to come with its own full-time crew, Luis can drive it.",
    ],
    bullets: [
      'Any harbor to any marina in Chicagoland',
      'One flat price plus rideshare to and from',
      'Captained by Luis',
    ],
    photo: 'quarters12',
    legs: ['relocation'],
    time: 'none',
    fallback: { relocation: { price: 475 } },
    priceNote: 'plus rideshare',
    passengers: false,
  },
];
