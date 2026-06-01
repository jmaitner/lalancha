// Single source of truth for the "Where we go" destinations.
// Used by the homepage list and the per-destination SEO pages.

export interface Destination {
  slug: string;
  short: string;        // homepage label (uppercase)
  name: string;         // page title-case name
  tag: string;          // pill label
  cls: 'blue' | 'gold' | 'pink' | 'magenta';
  hero: string;         // image filename in /images (no extension)
  blurb: string;        // one-liner
  title: string;        // <title>
  description: string;  // meta description
  intro: string;        // lead paragraph
  sections: { h: string; p: string }[];
  bestFor: string[];
  goodToKnow: string[];
  faqs: { q: string; a: string }[];
}

export const destinations: Destination[] = [
  {
    slug: 'playpen',
    short: 'PLAYPEN',
    name: 'The Playpen',
    tag: 'TOP PICK',
    cls: 'blue',
    hero: 'quarters20',
    blurb: "Chicago's legendary boat-party anchorage.",
    title: 'Boat Charter to The Playpen, Chicago | lancha boat',
    description:
      "Charter Quarters out to The Playpen — Chicago's famous boat-party anchorage off Ohio Street Beach. Raft up, swim, and soak in the skyline. Private charters from Diversey Harbor.",
    intro:
      "If you only do one thing on the water in Chicago, make it The Playpen. Known to locals as “the Pen,” it’s the floating block party just off Ohio Street Beach where boats raft up, music plays, and the skyline does the rest. It’s the reason this is our top pick — and the easiest way to feel like you have the whole lake to yourself, together with everyone else.",
    sections: [
      { h: 'Why it earns Top Pick',
        p: "The Playpen is pure Chicago summer: warm, shallow-feeling water inside a protected pocket, boats tied together, people swimming between them, and the skyline standing tall behind it all. It’s social, it’s sunny, and it’s the best people-watching on the lake." },
      { h: 'What a day at the Pen looks like',
        p: "We push off from our Diversey Harbor slip and it’s a short, scenic cruise down the lakefront to the anchorage. Once we’re in, you swim, float, sun, snack, and vibe. Your captain handles the anchoring and keeps everything safe — you just enjoy it." },
      { h: 'Bring your own whatever',
        p: "Because Quarters is a bareboat charter, the day is yours to stock. Pack a cooler, your favorite drinks, snacks, a speaker, and floaties. We’ll take care of the boat and the captain." },
    ],
    bestFor: ['Birthdays & bachelor / bachelorette parties', 'Big social groups', 'Swimming & floating', 'Soaking up the sun'],
    goodToKnow: ['~10–15 min cruise from our Diversey Harbor slip', 'Best on warm, calm afternoons', 'The Afternoon block (2:30–6:30 PM) is prime', 'Bring towels, sunscreen, and a cooler'],
    faqs: [
      { q: 'What is the Playpen in Chicago?', a: "The Playpen is a popular boat anchorage on Lake Michigan just off Ohio Street Beach and Streeterville, where boats raft up together for a social, party-style day on the water. Locals call it “the Pen.”" },
      { q: 'Can you swim at the Playpen?', a: "Yes — swimming and floating between rafted boats is the whole point. Your USCG-licensed captain anchors safely so you can hop in and enjoy the water." },
      { q: 'How long does it take to get to the Playpen from Diversey Harbor?', a: 'Roughly 10–15 minutes by boat, so you spend more of your charter actually at the anchorage.' },
    ],
  },
  {
    slug: 'south-loop',
    short: 'SOUTH LOOP',
    name: 'The South Loop & Museum Campus',
    tag: 'CITY VIEW',
    cls: 'gold',
    hero: 'quarters5',
    blurb: 'The full skyline, head-on.',
    title: 'South Loop & Museum Campus Boat Charter, Chicago | lancha boat',
    description:
      'Cruise south past Museum Campus and the Adler Planetarium point for the best head-on view of the Chicago skyline. Private charters aboard Quarters from Diversey Harbor.',
    intro:
      "Want the postcard? Head south. Cruising down the lakefront toward the Museum Campus delivers the cleanest, most complete view of the Chicago skyline there is — the whole wall of the city, rising straight out of the lake. It’s the move for first-timers, photographers, and anyone who wants that one perfect shot.",
    sections: [
      { h: 'The best skyline view in the city',
        p: "The point by the Adler Planetarium is the spot — turn back toward the city and the entire skyline lines up in front of you, water in the foreground, towers behind. It’s the photo everyone wants and the view that makes people fall for Chicago." },
      { h: 'Golden hour is unreal',
        p: "Book the late-afternoon or evening window and watch the buildings catch the light and then start to glow as the sun drops. Quiet water, warm colors, big city — hard to beat." },
      { h: 'Easy, scenic cruising',
        p: "The run down the lakefront is part of the fun, passing the harbors and beaches along the way. Smooth, scenic, and great for a relaxed group that wants to take it all in." },
    ],
    bestFor: ['First-timers', 'Skyline photos', 'Sunset cruises', 'Couples & date days'],
    goodToKnow: ['Scenic cruise south along the lakefront', 'Golden hour is the move for photos', 'Great in the Afternoon or Night block', 'Calm evenings give the glassiest reflections'],
    faqs: [
      { q: 'Where is the best place to see the Chicago skyline from the water?', a: 'The area off Museum Campus near the Adler Planetarium point gives the cleanest head-on view of the full downtown skyline rising out of the lake — the classic Chicago postcard shot.' },
      { q: 'Is the South Loop cruise good for sunset?', a: 'Yes — the late-afternoon and evening blocks catch golden hour, when the skyline lights up and the water goes calm and reflective.' },
    ],
  },
  {
    slug: 'navy-pier',
    short: 'NAVY PIER',
    name: 'Navy Pier',
    tag: 'SHORT TRIP',
    cls: 'pink',
    hero: 'img_2080',
    blurb: "Chicago's icon — and summer fireworks.",
    title: 'Navy Pier Boat Charter & Fireworks, Chicago | lancha boat',
    description:
      'See Navy Pier and its Ferris wheel from the water — and catch the summer fireworks from the best seats on the lake. Short, sweet private charters aboard Quarters.',
    intro:
      "Navy Pier is the most recognizable spot on the Chicago lakefront — and the best way to see it is from a boat looking back at it. It’s a short, easy trip that punches way above its weight, especially on summer fireworks nights when the sky over the pier puts on a show just for the people on the water.",
    sections: [
      { h: 'The icon from the water',
        p: "The Ferris wheel, the lights, the crowds on the pier — it all looks better from a little ways offshore, drink in hand, with no lines and no parking. A short cruise from Diversey gets you front-row." },
      { h: 'Fireworks from the best seats in the house',
        p: "In summer, Navy Pier launches fireworks on Wednesday and Saturday nights. From the water you get an unobstructed, reflection-on-the-lake view that beats any spot on land. The Night block is made for this." },
      { h: 'Short and sweet',
        p: "Short on time but want the quintessential Chicago moment? This is it — a compact trip that still delivers the icon, the lights, and the lake." },
    ],
    bestFor: ['Fireworks nights', 'Short outings', 'Visitors & first-timers', 'Evening cruises'],
    goodToKnow: ['Summer fireworks: Wednesdays & Saturdays', 'The Night block (7–11 PM) lines up with showtime', 'A short cruise from Diversey Harbor', 'Bring a layer — it cools off after dark on the water'],
    faqs: [
      { q: 'When are the Navy Pier fireworks?', a: 'Navy Pier runs its summer fireworks on Wednesday and Saturday evenings. Times vary by night, so plan an evening (Night block) charter to catch them from the water.' },
      { q: 'Can you watch the Navy Pier fireworks from a boat?', a: 'Yes — watching from the water is the best seat in the house, with an unobstructed view and the lights reflecting off the lake.' },
    ],
  },
  {
    slug: 'burnham',
    short: 'BURNHAM',
    name: 'Burnham Harbor & Northerly Island',
    tag: 'BAYSIDE VIEW',
    cls: 'magenta',
    hero: 'quarters7',
    blurb: 'Calm water, big views.',
    title: 'Burnham Harbor & Northerly Island Boat Charter | lancha boat',
    description:
      'Relaxed, protected cruising around Burnham Harbor and Northerly Island, with skyline and Museum Campus views — and lakeside concerts at the pavilion. Private charters aboard Quarters.',
    intro:
      "Burnham is the laid-back side of the lakefront. Tucked behind Northerly Island near the Museum Campus, the water here is calmer and the views are wide open — skyline on one side, lake on the other. It’s the pick for a relaxed cruise, a nervous first-timer, or a mellow group that just wants to drift and take it in.",
    sections: [
      { h: 'Calmer water, easy vibes',
        p: "The protected stretch around Burnham Harbor and Northerly Island tends to be smoother than the open lake — perfect if anyone in your crew is new to boating or just wants a gentle, low-key day." },
      { h: 'Skyline meets nature',
        p: "You get the best of both: the downtown skyline and Museum Campus on one side, and the open green of Northerly Island and the lake on the other. Wide, calm, and photogenic." },
      { h: 'Concerts on the water',
        p: "When the lakeside pavilion has a show, the area comes alive — some nights you can take in the city, the sunset, and a little music drifting across the water." },
    ],
    bestFor: ['Relaxed cruising', 'Nervous first-timers', 'Calmer days', 'Concert nights at the pavilion'],
    goodToKnow: ['Protected, generally calmer water', 'Skyline + Museum Campus backdrop', 'Great for a mellow group or mixed ages', 'Any block works — sunsets here are excellent'],
    faqs: [
      { q: 'Is Burnham Harbor a good spot for first-time boaters?', a: 'Yes — the water around Burnham Harbor and Northerly Island is more protected and tends to be calmer than the open lake, making it a comfortable choice for anyone new to boating.' },
      { q: 'What can you see from Burnham and Northerly Island?', a: 'You get sweeping views of the downtown skyline and Museum Campus on one side and the open lake and Northerly Island’s green space on the other.' },
    ],
  },
  {
    slug: 'the-river',
    short: 'THE RIVER',
    name: 'The Chicago River',
    tag: 'FAM FRIENDLY',
    cls: 'blue',
    hero: 'img_2523',
    blurb: 'Architecture up close, calm and easy.',
    title: 'Chicago River Architecture Boat Charter | lancha boat',
    description:
      'Glide through downtown on the Chicago River for an up-close architecture cruise on calm, flat water — the most family-friendly way to see the city aboard Quarters.',
    intro:
      "The Chicago River is the city at eye level. Glide between the skyscrapers on flat, protected water and see the architecture the way it was meant to be seen — up close, from below, slow enough to actually take it in. It’s calm, it’s easy, and it’s our most family-friendly route, from little kids to grandparents.",
    sections: [
      { h: 'The world-famous architecture, your way',
        p: "Chicago practically invented the skyscraper, and the river runs right through the best of it. On your own private charter you set the pace — linger at your favorites, snap photos, and skip the packed tour boats." },
      { h: 'Calm, flat, easy water',
        p: "The river is protected and smooth, with a relaxed no-wake pace. That makes it the most comfortable route we run — ideal for families, mixed ages, and anyone who wants the views without the open-lake bounce." },
      { h: 'Fun for the whole crew',
        p: "Kids love the bridges and the boats; adults love the architecture and the calm. Bring snacks, bring the family, and make a relaxed afternoon of it." },
    ],
    bestFor: ['Families & all ages', 'Architecture lovers', 'Calm-water cruising', 'Relaxed afternoons'],
    goodToKnow: ['Flat, protected, no-wake water', 'The most family-friendly route we run', 'Great in the Morning or Afternoon block', 'Easy on anyone prone to motion on open water'],
    faqs: [
      { q: 'Is a Chicago River boat charter good for kids and families?', a: 'Very — the river is calm, flat, protected water at a relaxed pace, which makes it the most comfortable and family-friendly route, suitable for all ages.' },
      { q: 'Can you see the Chicago architecture on a private charter?', a: 'Yes — a private charter on the river takes you right through downtown’s famous architecture at your own pace, without the crowds of a packed tour boat.' },
    ],
  },
];
