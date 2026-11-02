# Fuel Shift

**GitHub Game Off 2026 entry. Theme: SHIFT.**

Run a 24/7 roadside gas station and mini-mart for one day: three work shifts (morning, evening, night) of four minutes each.
Fill up cars, work the till, haul cartons to the shelves, bring jerry cans and tyres to the truckers, and spend your cash on
new pumps, shelves, upgrades and staff.

The twist is the **gearbox**. Your station runs in gears 1 to 5:

- **Shift up** and more customers arrive, prices go up (the price pylon by the road changes live), and patience gets shorter.
- **Shift down** when the queue gets out of hand. Every customer who walks out costs you a star. At zero stars the owner sends you home.

So SHIFT is in the game three times: the gear you run at, the work shift you are on (the station changes from dawn to the
night shift, with a different crowd each time), and the keys that drive it: on a keyboard, **Right Shift shifts up and
Left Shift shifts down**.

A run takes about 13 to 15 minutes. The score is the money you earned plus a bonus for the stars you still have at 06:00.
Between shifts you pick one perk card.

## Controls

| | Desktop | Phone / tablet |
|---|---|---|
| Move | WASD / arrow keys, or hold the left mouse button and drag | joystick in the bottom-left corner |
| Work | stand in a ring (pump, till, stock pallet, shelf) | same |
| Buy a station | stand on a gold pad | same |
| Gear up / down | Right Shift / Left Shift (or E / Q, or the buttons) | the up / down buttons, bottom right |
| Upgrades | U or the UPGRADES button | the UPGRADES button |
| Pause | P / Esc | the pause button |

## Run it locally

No build step. `public/` is the whole game (plain ES modules, three.js vendored).

```
node tools/serve.mjs 8811 public
# open http://localhost:8811/
```

Any static file server works. The game needs to be served over http (ES modules do not load from `file://`).

## Tech

- three.js r180 (vendored in `public/vendor`, MIT), no bundler, no framework.
- Every 3D prop comes from the free CC0 **Vuena Simulator Kits Sampler** (24 GLB models in `public/models`, unchanged).
- The people are the free CC0 **8 Blocky Characters** (rigged; idle, walk and run clips through a three.js `AnimationMixer`,
  carrying is an arm pose layered on top). The cars are the free CC0 **5 Toy Cars**. Both unchanged, in `public/chars` and `public/cars`.
- The building shell, ground, road and trees are simple shapes built in code.
- Customers, staff and the QA autopilot walk on an A* grid; parked cars block paths.
- Sounds: Kenney CC0 one-shots plus a synthesised engine hum whose pitch follows the gear (WebAudio).
- Phones: floating joystick in the bottom-left corner zone, big gear buttons bottom-right, hints shown at the controls.

### QA tools (`tools/`, headless Chrome over CDP)

The tools expect the repo root served on port 8811 (`node tools/serve.mjs 8811 .`, game at `/public/`) or a `URL=` environment variable,
and they use our headless-Chrome helper from a sibling repo (`popyca-games/scripts/lib/cdp.mjs`, not included here).

- `play.mjs` runs a full day with the in-page autopilot (`?bot`, `public/js/qa.js`). The autopilot moves through the same
  stick input a player uses, buys pads and upgrades and picks perks. The script reports the economy per shift, FPS and every
  console error.
- `gate.mjs` is a layout gate for the placed props (FLOAT / OVERLAP / WALL checks with ray casts, a three.js port of our
  Blender layout gate), plus close-up review shots.
- `viewcheck.mjs` puts the player on every work ring with the real camera and fails if the ring or the player is off-screen, under
  the HUD or hidden behind scenery; it also shoots the carried stacks (player and staff). `input.mjs` tests real keyboard,
  mouse and touch input. `posecheck.mjs` / `closeup.mjs` are close-up reviews of the animated characters.
- `artefacts.mjs` + `artefacts.py`: render-artefact check. Frames are re-rendered with the camera moved 1 px and with the sun
  turned 0.1 deg, plus a 3 s stepped clip with walking characters; flat surfaces must not change (z-fighting, acne, shimmer).
  `zfight.mjs` scans the live scene for faces of different objects in the same plane; `coplanar.mjs` scans the GLB files
  (coincident faces inside the models are separated by 1 mm at load time, in memory).
- `play.mjs ... &navcheck` records every NPC position each simulation step for a whole day: no wall / glass crossing outside a
  door, never inside a shelf or counter, NPCs at least a body radius apart, every waiting state explained by a bubble and resolved.
- `guidecheck.mjs`: carried jerry cans / tyres name their target car, nobody-needs-it message, skippable tutorial.
- `perf.mjs` measures FPS under CPU throttling. `media.mjs` makes the store screenshots and cover. `build.mjs` makes the itch.io zip.

## Credits

- **3D assets: Vuena Simulator Kits Sampler (CC0), https://vuena.itch.io/simulator-kits-sampler-free**.
  These are 24 free models from our four paid kits. The full Store, Gas Station, Modular Apartment Interior and Factory
  Simulator Kits (475 assets) are on [vuena.itch.io](https://vuena.itch.io).
- **Characters: 8 Free Blocky Characters (CC0), https://vuena.itch.io/blocky-characters-free-sample**
  (free sample of our 48 rigged characters pack).
- **Cars: 5 Free Toy Cars (CC0), https://vuena.itch.io/toy-cars-5-free** (free sample of our 50 toy cars pack).
- Sounds: [Kenney](https://kenney.nl) Interface Sounds, Impact Sounds and Music Jingles (CC0).
- three.js (MIT).
- Full list: [CREDITS.md](CREDITS.md).

## AI disclosure

The code of this game was written with AI assistance (Claude, by Anthropic), directed and reviewed by us.
The 3D models, characters and cars are from our own free CC0 packs, made with our own procedural code (AI-assisted tooling), not AI image or mesh generators.
The sounds are Kenney's. No AI-generated art or audio is used.

## Licence

- Code: MIT, see [LICENSE](LICENSE).
- 3D models in `public/models`, `public/chars` and `public/cars`: CC0 1.0, see the `LICENSE-CC0.txt` in each folder.
  Only the free CC0 sample files are in this repository; none of the paid packs.
- Sounds in `public/sfx`: CC0 1.0 (Kenney).
- three.js in `public/vendor`: MIT (`public/vendor/three/LICENSE`).
