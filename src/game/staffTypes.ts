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
      "Feeds animals, refreshes enrichment and cleans enclosures — the backbone of good welfare.",
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
