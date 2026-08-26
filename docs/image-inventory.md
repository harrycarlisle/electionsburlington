# Burlington News image inventory

Audit date: 2026-08-26. Rights notes are editorial, not legal advice.

Decision values: KEEP · REPLACE · MOVE INSIDE ARTICLE · SOURCE REAL PHOTO · CREATE EDITORIAL VISUAL

| story | current image | type | quality | location accuracy | rights confidence | hero suitability | card suitability | decision |
|---|---|---|---|---|---|---|---|---|
| How bad is crime in Burlington, really? | `/assets/stories/public-safety/halton-police-crime-burlington.webp` | Burlington News visual (forward-facing Halton police SUV, lights, crime-scene tape) | strong, crisp, works on 16:9 crop | suburban Halton/Burlington-plausible; not a named address | high (owned visual; not a documentary crime-scene photo) | strong | strong | KEEP |
| This Burlington team is 0–24 | hero/cards/OG: `/assets/ultimate-frisbee-burlington.png`; in-article rules: `/assets/ultimate-frisbee-7v7.png` | unlabeled recreational game photo (hero); labeled 7v7 field graphic (inside article only) | strong | suburban Burlington-area field; not identified as a Toss Bosses game | high (user-uploaded masters preserved; no photographer supplied) | strong | strong | KEEP — do not swap the two roles |
| A Burlington gathering place closed | `/assets/local-business/nostalgia-games-cafe.webp` (master: `/assets/nostaliga-games-cafe-image.png` and `/assets/local-business/nostalgia-games-cafe.png`) | real cafe interior photo | strong | interior of Nostalgia Candy Café; no photographer supplied | high (user-uploaded master preserved) | strong | strong | KEEP — do not revert to the FINAL GAME illustration |
| Burlington’s proposed data centre | `/assets/stories/data-centre/proposed-data-centre-3110-south-service-road.webp` | approved editorial site concept | strong | 3110 South Service Road context | high if kept labelled as concept, not a final rendering | strong | strong | KEEP |
| Ontario nearly replaced the Skyway | hero `/assets/home/skyway.webp`; cards/OG `/assets/home/skyway-reader.webp` | real landmark photography | strong | accurate Skyway | high (Dave Lauretti, CC BY 2.0) | strong | strong | KEEP |
| Ribfest turns 30 | `/assets/home/ribs.webp` | photograph | strong | generic pit, not a named Burlington booth | Wikimedia / credited | strong | strong | KEEP |
| Can a teacher take your phone? | `/assets/home/school-rights.webp` | illustration | generic but clean | Ontario school bus, not a named Burlington school | owned | acceptable | acceptable | KEEP |
| The dates families need before school starts | `/assets/home/school-bus.webp` | photograph/illustration | generic | generic school bus | source in story | acceptable | acceptable | KEEP |
| 730 Brant sat empty | `/assets/editorial/730-brant-vacant-building.webp` (also `730-brant-share.webp`) | original editorial visual of a vacant four-storey mid-century commercial building | strong replacement for the old flat “730 BRANT STREET” graphic | grounded in the vacant 730 Brant Street site; not 790 Brant; not a fire-scene photograph | high (owned Burlington News visual). BurlingtonToday’s Feb. 9, 2026 fire photo by Calum O’Malley was used only as a factual reference and was not reused. | strong | strong | KEEP |
| A bat in Burlington tested positive for rabies | `/assets/explore/night-sky-mount-nemo.webp` | photograph | strong photo, wrong subject | escarpment night sky, not a bat / not the case site | reused explore asset | weak as story hero | weak reuse vs quarry card | SOURCE REAL PHOTO or CREATE EDITORIAL VISUAL later |
| Nelson Quarry tribunal decision | `/assets/explore/night-sky-mount-nemo.webp` | photograph | strong photo, reused | Mount Nemo area is relevant; same file as rabies | reused explore asset | weak reuse | weak (twins the rabies card) | SOURCE REAL PHOTO of the quarry / escarpment later |
| Millcroft Phase 2 | `/assets/explore/burlington-orientation-map.svg` | diagram | flat | city-scale map, not the golf-course site | owned | poor as hero | poor as card | KEEP map inside article if useful; SOURCE REAL PHOTO for hero/cards later |
| Upper Middle Road construction | `/assets/explore/burlington-orientation-map.svg` | diagram | flat | city-scale map, not the corridor | owned | poor as hero | poor as card | KEEP map inside article if useful; SOURCE REAL PHOTO / CREATE EDITORIAL VISUAL of the road later |
| What 26,503 fish revealed | `/assets/home/fishway.webp` | photograph | strong | Cootes Paradise Fishway | credited in story | strong | strong | KEEP |
| Why Burlington closes a road for salamanders | `/assets/home/salamander.webp` | photograph | strong | species-correct | credited in story | strong | strong | KEEP |
| Ward map changed | `/assets/editorial/burlington-wards-2026.svg` | diagram | clear, text-heavy | Burlington 2026 wards | owned | OK for a map story | weak on small cards | KEEP (map is the hook) |
| Election field / candidates | `/assets/candidates/mw.webp`, `lk.webp`, `rn.webp`, `yr.webp` | real portraits | strong where present | named candidates | existing repo assets | n/a (guide) | strong | KEEP; do not invent a Keith Demoe portrait |
| Crime CSI comparison chart | `/assets/editorial/halton-crime-comparison.svg` | chart | clear | Halton regional, not a Burlington street | owned | do not use as hero | do not use as card | MOVE INSIDE ARTICLE (already in-article only) |
| Older rear-facing police SUV | `/assets/editorial/halton-police-dusk.webp` | older visual | unused as hero | n/a | owned | retired | retired | REPLACE everywhere — file retained but no live hero/card/OG refs |

## This pass

- Crime story: canonical path is `/assets/stories/public-safety/halton-police-crime-burlington.webp`. Credit: Burlington News visual. Old dusk SUV is remapped away in `home.js` and `article-modern.js`.
- Toss Bosses hero/cards/OG: `/assets/ultimate-frisbee-burlington.png`. In-article rules visual: `/assets/ultimate-frisbee-7v7.png`. No photographer was supplied for either, so do not invent a credit. Credit the labeled 7v7 as a Burlington News graphic. Do not imply either photo depicts Toss Bosses specifically. Do not use the waterfront illustration as the story image.
- Cafe: `/assets/local-business/nostalgia-games-cafe.webp`. No photographer was supplied, so do not invent a credit. The old FINAL GAME illustration is retired from primary surfaces.
- Kerncliff Park (official City spelling): `/assets/explore/kerncliff-park.webp`. Master: `/assets/Kerncliffe-Park.png`.
- Winona Peach Festival: `/assets/explore/winona-peach-festival.webp`. Master: `/assets/Peaches.jpg`.
- E-scooter story: original diagram `/assets/editorial/centennial-trail-e-scooter.webp` (SVG master retained). Do not invent documentary photography.

## Keep (do not overwrite)

- Forward-facing Halton police visual
- Approved data-centre site concept
- Skyway photography
- Ribfest ribs
- Fishway and salamander photos
- Candidate photos already in the repo
- Brant Street Pier / farmers market / Mount Nemo night sky as explore assets

## Do not use as documentary

- Crime SUV as the scene of a specific incident
- Data-centre concept as an approved building rendering
- Ultimate waterfront illustration as a Toss Bosses game
- Orientation map as a stand-in for every development story
- Cafe “FINAL GAME” graphic as a photo of the closed shop

## Gaps still needing replacement

- Cafe: real exterior/interior, rights-safe
- Rabies: dedicated public-health / bat visual that is not the night-sky reuse
- Nelson quarry: site or escarpment photo that is not the rabies twin
- Millcroft: site / golf-course lands photo
- Upper Middle Road: construction / corridor photo
- More owned downtown, GO, winter, and food photography
