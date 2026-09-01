// Unified people directory for the /crew pages.
// Captains come from captains.ts; everyone else from crew.ts. Both the /crew
// index and the /crew/[slug] profile pages read from here, so a captain and a
// deck hand render through the same template and live at the same URL shape.

import { captains, type Photo } from './captains.ts';
import { crewGroups } from './crew.ts';

export interface Person {
  slug: string;
  name: string;            // big name in the profile hero
  cardName: string;        // name shown on the /crew index card
  role: string;            // "Captain", "Dock Attendant", "Deck Hand", ...
  isCaptain: boolean;
  tagline?: string;        // one-liner under the hero name / on the card
  bio: string;
  photos: Photo[];
  credentials: string[];   // shown as badges
  credentialsLabel: string;
}

// Captains, with Luis first, then the rest in captains.ts order.
export const captainPeople: Person[] = [...captains]
  .sort((a, b) => (a.slug === 'luis' ? -1 : b.slug === 'luis' ? 1 : 0))
  .map((c) => ({
    slug: c.slug,
    name: c.name,
    cardName: c.handle,
    role: 'Captain',
    isCaptain: true,
    tagline: c.tagline,
    bio: c.bio,
    photos: c.photos,
    credentials: c.credentials,
    credentialsLabel: 'Licenses & Certifications',
  }));

// Everyone else (deck hands, dock attendants), flattened across their groups.
export const crewPeople: Person[] = crewGroups.flatMap((g) =>
  g.members.map((m) => ({
    slug: m.slug,
    name: m.name,
    cardName: m.name,
    role: g.role,
    isCaptain: false,
    tagline: m.blurb,
    bio: m.bio ?? '',
    photos: m.photo ? [m.photo] : [],
    credentials: m.stats ?? [],
    credentialsLabel: 'Good to know',
  }))
);

// Everyone, for getStaticPaths on the profile route.
export const people: Person[] = [...captainPeople, ...crewPeople];
