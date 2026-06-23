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
  name: string;
  photo?: string;   // /images filename, no extension (optional)
  blurb?: string;   // short one-liner (optional)
}

export interface CrewGroup {
  role: string;     // singular, shown on each card pill, e.g. "Deck Hand"
  plural: string;   // section heading, e.g. "Deck Hands"
  blurb?: string;   // optional one-line section intro
  members: CrewMember[];
}

export const crewGroups: CrewGroup[] = [
  {
    role: 'Deck Hand',
    plural: 'Deck Hands',
    blurb: 'The extra set of hands that keeps your day running smooth.',
    members: [
      // { name: 'First Last', photo: 'deckhand-1', blurb: 'Knot expert and cooler captain.' },
    ],
  },
  {
    role: 'Dock Attendant',
    plural: 'Dock Attendants',
    blurb: 'Your first hello and last wave at Diversey Harbor.',
    members: [
      // { name: 'First Last', photo: 'dock-1', blurb: 'Gets you aboard and on your way.' },
    ],
  },
];
