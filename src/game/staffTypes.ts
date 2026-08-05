/**
 * Wildhaven — staff roles.
 *
 * The people who keep the park running. Each role has a daily wage, a one-off
 * hiring cost, and a short description of what it does for the simulation.
 */

import type { StaffRole, StaffRoleDef } from "./types";

export const STAFF_ROLES: StaffRoleDef[] = [
  {
    role: "keeper",
    name: "Zookeeper",
    icon: "🧑‍🌾",
    color: "#2d6a4f",
    wage: 120,
    hireCost: 400,
    description:
      "Feeds animals and refreshes enrichment — the backbone of good welfare. Light tidy-up while feeding.",
  },
  {
    role: "cleaner",
    name: "Habitat Cleaner",
    icon: "🧹",
    color: "#4a8f6a",
    wage: 100,
    hireCost: 320,
    description:
      "Deep-cleans enclosures: scrapes pads, refreshes bedding, and restores habitat hygiene.",
  },
  {
    role: "vet",
    name: "Veterinarian",
    icon: "🩺",
    color: "#3d7fa6",
    wage: 180,
    hireCost: 700,
    description:
      "Diagnoses and treats sick animals, restoring health before problems spread.",
  },
  {
    role: "janitor",
    name: "Janitor",
    icon: "🗑️",
    color: "#5a6a7a",
    wage: 85,
    hireCost: 280,
    description:
      "Empties litter bins and picks up trash guests leave on paths — keeps the park welcoming.",
  },
  {
    role: "vendor",
    name: "Vendor",
    icon: "🧑‍🍳",
    color: "#c9a227",
    wage: 90,
    hireCost: 250,
    description:
      "Staffs shops and stalls. More vendors mean shorter queues and higher takings.",
  },
  {
    role: "mechanic",
    name: "Mechanic",
    icon: "🔧",
    color: "#b5651d",
    wage: 110,
    hireCost: 350,
    description:
      "Repairs fences and facilities, slowing the wear that would otherwise let animals escape.",
  },
];

/** Fast lookup by role. */
export const STAFF_ROLES_BY_ID: Record<StaffRole, StaffRoleDef> =
  Object.fromEntries(STAFF_ROLES.map((r) => [r.role, r])) as Record<
    StaffRole,
    StaffRoleDef
  >;

/** Look up a staff role definition. */
export function getStaffRole(role: StaffRole): StaffRoleDef {
  return STAFF_ROLES_BY_ID[role];
}

/** Long-form copy for the Jobs overview menu. */
export const JOB_OVERVIEWS: Array<{
  role: StaffRole;
  title: string;
  summary: string;
  duties: string[];
}> = [
  {
    role: "keeper",
    title: "Zookeeper",
    summary: "Animal care first — feeding and enrichment.",
    duties: [
      "Feeds the hungriest animals on a regular pulse",
      "Gives a light hygiene boost while working an enclosure",
      "Works faster at night during the maintenance shift",
      "Benefits from a Keeper Hut placed near habitats",
    ],
  },
  {
    role: "cleaner",
    title: "Habitat Cleaner",
    summary: "Keeps enclosures spotless so welfare stays high.",
    duties: [
      "Deep-cleans the dirtiest habitats each care pulse",
      "Counters daily hygiene decay inside enclosures",
      "Pairs well with keepers — feeders + scrubbers",
      "Essential once you run several large habitats",
    ],
  },
  {
    role: "vet",
    title: "Veterinarian",
    summary: "Medical care for sick and injured animals.",
    duties: [
      "Treats low-health and sick animals",
      "Prevents deaths from illness and starvation fallout",
      "Stronger with a Veterinary Clinic on site",
      "Hire early if you keep endangered or high-cost species",
    ],
  },
  {
    role: "janitor",
    title: "Janitor",
    summary: "Guest-path cleanliness — bins and ground litter.",
    duties: [
      "Empties the fullest litter bins",
      "Picks up trash piles guests leave on paths",
      "Stops mess from dragging guest happiness down",
      "Place litter bins along busy paths so guests can dispose properly",
    ],
  },
  {
    role: "vendor",
    title: "Vendor",
    summary: "Runs shops so guests actually spend.",
    duties: [
      "Boosts food, drink, and gift shop throughput",
      "Raises estimated daily sales in the inspector",
      "Hire after stalls are placed — idle vendors still cost wages",
    ],
  },
  {
    role: "mechanic",
    title: "Mechanic",
    summary: "Keeps buildings and fences from falling apart.",
    duties: [
      "Slows daily condition wear on all facilities",
      "Repairs buildings faster during the night shift",
      "Critical for parking lots, shops, and fence rings",
    ],
  },
];
