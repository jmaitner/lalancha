// Non-captain crew for the /crew page (deck hands, dock attendants, etc.).
// Captains live in captains.ts — they each get a full profile page, so the
// crew page pulls them from there. Everyone else is listed here.
//
// TO ADD SOMEONE: drop an object into the right group's `members` array.
// Put their photo in /public/images (e.g. deckhand-1.jpg) and reference it
// by filename without the extension. Empty groups show a "coming soon" note.
//
// TO ADD A NEW ROLE: add another CrewGroup to the array below.

export interface CrewMember {
  slug: string;     // profile URL: /crew/<slug>
  name: string;
  photo?: string;   // /images filename, no extension (optional)
  blurb?: string;   // short one-liner for the crew-index card (optional)
  bio?: string;     // longer paragraph (optional)
  stats?: string[]; // stat / credential badges (optional)
}

export interface CrewGroup {
  role: string;     // singular, shown on each card pill, e.g. "Deck Hand"
  plural: string;   // section heading, e.g. "Deck Hands"
  blurb?: string;   // optional one-line section intro
  members: CrewMember[];
}

export const crewGroups: CrewGroup[] = [
  {
    // Dock + deck merged into one role (Luis's call).
    role: 'Deckhand',
    plural: 'Deckhands',
    blurb: 'The crew who keep every charter running, dock to deck.',
    members: [
      {
        slug: 'evan',
        name: 'Evan Richards',
        blurb: "New to boats, and the first face you'll meet at the dock.",
        photo: 'evan-1',
        bio: "Evan is new to boats and an engineer by trade, and he's the friendly face you'll almost certainly meet at the dock before and after your charter, so say hi. He's learning a ton and taking on more and more responsibility, which is a nice way of saying he gets handed more and more. He's also open to a few shifts as a deck hand if you'd like him out on the water with you.",
        stats: ['Drivers License', 'Better at Hockey', 'First Aid', 'Stop the Bleed'],
      },
    ],
  },
];
