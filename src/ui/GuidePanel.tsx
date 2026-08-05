/**
 * Wildhaven — Keeper's Guide.
 *
 * In-game handbook for not going broke and keeping animals thriving.
 * Content mirrors the real economy / welfare models in game/*.ts.
 */

import { useState, type ReactNode } from "react";
import { useUIStore } from "../store/uiStore";

type SectionId = "start" | "money" | "animals" | "habitats" | "staff" | "guests";

const SECTIONS: { id: SectionId; icon: string; title: string }[] = [
  { id: "start", icon: "🌅", title: "First days" },
  { id: "money", icon: "💰", title: "Don't go broke" },
  { id: "animals", icon: "🦁", title: "Keep animals alive" },
  { id: "habitats", icon: "🌿", title: "Build good habitats" },
  { id: "staff", icon: "🧑‍🌾", title: "Hire the right staff" },
  { id: "guests", icon: "🎟️", title: "Happy guests" },
];

export default function GuidePanel() {
  const open = useUIStore((s) => s.guideOpen);
  const close = useUIStore((s) => s.toggleGuide);
  const [section, setSection] = useState<SectionId>("start");

  if (!open) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Keeper's Guide">
      <div className="modal__scrim" onClick={close} />
      <div className="modal__card glass guide">
        <header className="modal__head">
          <h2>Keeper&apos;s Guide</h2>
          <button type="button" className="modal__close" aria-label="Close" onClick={close}>
            ×
          </button>
        </header>

        <p className="guide__lede">
          How to keep the cash flowing and every creature thriving — written for
          Wildhaven&apos;s real systems, not wishful thinking.
        </p>

        <nav className="guide__nav" aria-label="Guide sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={section === s.id ? "guide__chip guide__chip--on" : "guide__chip"}
              onClick={() => setSection(s.id)}
            >
              <span aria-hidden>{s.icon}</span> {s.title}
            </button>
          ))}
        </nav>

        <div className="guide__body">{CONTENT[section]}</div>
      </div>
    </div>
  );
}

const CONTENT: Record<SectionId, ReactNode> = {
  start: (
    <>
      <h3>Open strong, spend slow</h3>
      <ol className="guide__list">
        <li>
          You start with a demo park and a healthy balance. <strong>Pause (⏸)</strong> if
          you need a breath — bills still wait for the next day, but nothing drifts while
          you plan.
        </li>
        <li>
          Click an animal to read its welfare bars, or open the <strong>Animal
          overview</strong> (🐾 or click Welfare) to see every creature at once.
          Red bars are jobs for you; green means leave them alone for now.
        </li>
        <li>
          Fix the flamingos in Mirror Lagoon first — they&apos;re hungry and under-social.
          Add more flamingos (Animals tab) and enrichment (Scenery tab → pool items).
        </li>
        <li>
          A full day/night cycle lasts about <strong>15 minutes</strong> at 1×. Daytime
          brings guests; night closes the gates for maintenance and building. Use
          <strong> 2× / 3×</strong> if you want to skip the night.
        </li>
        <li>
          Open <strong>Finances</strong> (click Balance) and glance at today&apos;s costs
          before buying a second elephant.
        </li>
      </ol>
      <p className="guide__tip">
        Need more room? Open Finances (click Balance) and buy individual land plots on
        the map — expand any direction. South plots sit by parking and the entrance;
        keep the lot maintained so guests can arrive.
      </p>
    </>
  ),

  money: (
    <>
      <h3>Where money comes from</h3>
      <ul className="guide__list">
        <li>
          <strong>Tickets</strong> — guests enter and pay your ticket price. Higher appeal
          (happy, interesting animals) draws more people. Tickets above ~$18 slowly scare
          guests away; below that packs the park but earns less per head.
        </li>
        <li>
          <strong>Shops</strong> — food stalls, drink stalls, and gift shops earn when
          guests visit them. Place them on paths near habitats. Hire Vendors so queues
          don&apos;t kill takings.
        </li>
        <li>
          <strong>Donations</strong> — grow with guest happiness and Info Boards. Cheap
          conservation points, literally.
        </li>
      </ul>
      <h3>Where money goes</h3>
      <ul className="guide__list">
        <li>
          <strong>Food</strong> — every animal has a daily food bill that accrues
          through the day (shown under Animal food). Big carnivores and elephants
          eat your margin.
        </li>
        <li>
          <strong>Staff wages</strong> — keepers, vets, vendors, mechanics. Wages
          accrue continuously; idle payroll is silent bankruptcy.
        </li>
        <li>
          <strong>Upkeep</strong> — every placed building costs a little each day
          (fences are cheap; shops and clinics cost more).
        </li>
        <li>
          <strong>Construction</strong> — one-off buys (animals, buildings, hires,
          land). These hit Balance and Net today immediately.
        </li>
      </ul>
      <p className="guide__tip">
        If Balance turns red or you see a bankruptcy toast: pause, raise ticket a notch
        (or lower if the park is empty), sell nothing — instead stop hiring, demolish
        unused stalls, and feed welfare so appeal recovers.
      </p>
    </>
  ),

  animals: (
    <>
      <h3>Welfare is survival</h3>
      <p>
        Each animal scores 0–100 from biome, climate, space, social group, enrichment,
        hunger, and health. Hunger and health weigh heaviest — ignore them and the rest
        won&apos;t save the animal.
      </p>
      <ul className="guide__list">
        <li>
          <strong>Hunger</strong> — zookeepers feed animals automatically. No keepers
          → hunger collapses → health fails → the animal dies. A Keeper Hut near an
          enclosure speeds feeding.
        </li>
        <li>
          <strong>Health</strong> — starvation and illness drain health. Hire a vet
          (and build a Vet Clinic) before it hits zero — death is permanent.
        </li>
        <li>
          <strong>Social</strong> — check the species card. Lions want a pride; a lonely
          tiger is fine; overcrowding hurts too. Match social min/max.
        </li>
        <li>
          <strong>Enrichment</strong> — place the exact toys they need (ball, scent/log,
          climb, pool, nest) inside the fence. Partial matches only half-score.
        </li>
        <li>
          <strong>Biome</strong> — wrong biome caps welfare hard (~35). Savanna animals
          in forest habitats will never thrive.
        </li>
      </ul>
      <p className="guide__tip">
        Click the animal → read the red bars → fix those first. Camera focus helps you
        find the enclosure in 3D.
      </p>
    </>
  ),

  habitats: (
    <>
      <h3>Enclosure checklist</h3>
      <ol className="guide__list">
        <li>
          Open <strong>Habitat</strong>, pick a <strong>biome</strong> (Savanna, Forest,
          …). That biome applies to new enclosures and to whatever habitat you have
          selected.
        </li>
        <li>
          Ring a closed fence (Habitat tools → Fence), drop a Gate on one side. When the
          loop closes, Wildhaven auto-claims it — or use <strong>Claim habitat</strong>{" "}
          and click inside.
        </li>
        <li>
          Click the habitat tint / select it, then change biome chips if you picked the
          wrong one. Temp and humidity update with the biome.
        </li>
        <li>
          Give enough area — large/huge animals need big footprints. Crowding tanks the
          Space bar even if the fence looks fine.
        </li>
        <li>
          Drop enrichment <em>inside</em> the ring. Water features and pools count for
          wallowing species.
        </li>
        <li>
          Add a Viewing Gallery or path along the fence so guests can see the animals —
          appeal needs eyeballs.
        </li>
      </ol>
      <p className="guide__tip">
        One solid habitat beats three half-finished ones. Finish welfare before expanding.
      </p>
    </>
  ),

  staff: (
    <>
      <h3>Who to hire when</h3>
      <ul className="guide__list">
        <li>
          <strong>Zookeeper</strong> ($400 hire / $120 day) — mandatory once you have
          animals. Feeding and light tidy-up.
        </li>
        <li>
          <strong>Habitat Cleaner</strong> ($320 / $100) — deep-cleans enclosures.
          Hygiene decays daily; cleaners keep welfare from tanking.
        </li>
        <li>
          <strong>Janitor</strong> ($280 / $85) — empties litter bins and picks up path
          trash. Guests litter as they walk; mess hurts happiness.
        </li>
        <li>
          <strong>Veterinarian</strong> ($700 / $180) — hire when health dips or you run
          expensive endangered species.
        </li>
        <li>
          <strong>Vendor</strong> ($250 / $90) — after you place stalls. Shops without
          vendors underperform.
        </li>
        <li>
          <strong>Mechanic</strong> ($350 / $110) — when fences and facilities start
          wearing down (condition decays each day).
        </li>
      </ul>
      <p className="guide__tip">
        Open the <strong>Jobs</strong> menu (👷) for a full rundown of every role. Place
        litter bins on busy paths before hiring your first janitor.
      </p>
    </>
  ),

  guests: (
    <>
      <h3>Make the park worth the ticket</h3>
      <ul className="guide__list">
        <li>
          Paths from the entrance to every habitat. Guests walk paths — if they can&apos;t
          reach a view, they don&apos;t pay at shops either.
        </li>
        <li>
          Food + drink near popular exhibits. Gift shop for surplus happiness spend.
        </li>
        <li>
          Toilets and benches keep happiness from rotting while they queue.
        </li>
        <li>
          Info Boards boost donations. Cheap win once the park is walking.
        </li>
        <li>
          High animal welfare → higher appeal → more guests → more ticket + shop income.
          Welfare is your marketing budget.
        </li>
        <li>
          <strong>Park hours</strong> — guests arrive through the day and clear out at
          dusk. Shops close at night; keepers and mechanics work faster while the park
          is empty. Speed up overnight if you&apos;d rather jump to dawn.
        </li>
        <li>
          <strong>Parking</strong> — arrivals scale with parking condition and how many
          lots you&apos;ve built. Expand south from Finances, place extra lots (Guest tab),
          and hire mechanics so asphalt doesn&apos;t choke the gates.
        </li>
      </ul>
      <p className="guide__tip">
        Sweet spot ticket price starts around <strong>$18</strong>. Nudge up only when
        appeal and welfare are strong; nudge down if guest count collapses.
      </p>
    </>
  ),
};
