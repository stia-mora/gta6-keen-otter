# Solano Heat

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/stia-mora/gta6-keen-otter/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/stia-mora/gta6-keen-otter/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the fictional coastal city of **Port Solano**,
built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01).
Everything is original: the city, the characters, the vehicles, the story,
the art and the sound. Nothing comes from any commercial game.

## The story

Mara Reyes, a getaway driver, owes the fixer Silas Kane $40,000. Six jobs
pay it down: steal a ride, run a package through the docks, shake a
three-star tail, beat a two-minute delivery, drop three packages while the
whole city is looking for her, and one last bank job. Between jobs she can
drive taxi fares, hunt twelve hidden cash stashes, and keep the car — the
city is hers to roam.

## The city

A 3840 × 2880 grid with five districts — Downtown, Old Town, the Harbor,
the Beachfront and the Industrial north — plus the bay to the east and the
sea to the south. Explore it **on foot and by car**: traffic drives the
road graph, pedestrians stroll the sidewalks and run when shots ring out,
and police cars and foot officers answer the wanted level.

## What is in the game

- **Driving** — arcade car physics, steering, handbrake slides, skid
  marks, damage, smoke and explosions; steal any civilian car (E).
- **Wanted system** — 0 to 5 stars. Stealing, hitting pedestrians,
  assault and gunfire raise the heat; black-and-white police cars with
  flashing light bars chase and ram, officers chase on foot and bust you,
  and at four stars they shoot. Lay low to cool off, or pay $200 at a
  Spray & Go for fresh paint and a clean record.
- **Missions and story** — six story jobs with briefings, map markers,
  timers and payouts, plus taxi fares and hidden stashes.
- **Combat** — punch on foot, pick up a pistol and shoot with the mouse;
  cops fight back.
- **HUD and minimap** — health, armor, cash, wanted stars, the clock,
  the objective with its distance, speed, a live minimap showing
  roads, police blips, the player and the objective, and the radio
  station with its current track.
- **Radio** — three synthesized stations on the dial (SOLANO FM 87.9
  Sunset Drive, HEAT 102.4 Street Beats, BAY 94.1 Coastal Jazz), each
  with its own tracks and groove. R switches station.
- **Menus and save** — title screen, pause menu, mission briefings,
  wasted / busted screens, and a localStorage save that keeps money,
  story progress, stashes and position.
- **Sound** — everything synthesized live with WebAudio: engine hum,
  two-tone sirens, gunshots, crashes, pickups, mission jingles and the
  three radio stations. No audio files. M mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Shift | Run |
| E | Enter / steal / exit a car, pick up, start a job |
| Space | Punch on foot, handbrake while driving |
| Mouse + click | Aim and shoot (pistol) |
| T | Take a taxi fare (in a car, near a stand) |
| R | Switch radio station |
| X | Spray & Go (in a car, near a purple S) |
| Esc / P | Pause |
| M | Mute |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is static files only.

## Layout

- `game/index.html` — the page and its canvas
- `game/src/main.js` — the game loop, states and combat
- `game/src/city.js` — Port Solano: districts, roads, buildings, places
- `game/src/vehicles.js` — car physics, traffic AI
- `game/src/pedestrians.js` — pedestrians and fleeing
- `game/src/player.js` — Mara on foot and behind the wheel
- `game/src/police.js` — the wanted system and police AI
- `game/src/missions.js` — the six story jobs, taxi fares, stashes
- `game/src/render.js` — the camera and how the city looks
- `game/src/hud.js` — HUD, minimap and menus
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/input.js` — keyboard and mouse
- `game/src/save.js` — localStorage save and load
- `game/src/effects.js` — particles, skids, shake
- `game/src/utils.js` — math and random helpers
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library

## License

MIT — see `LICENSE`.
