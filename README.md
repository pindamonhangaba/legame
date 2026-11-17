# Saltbound

A 3D isometric adventure built with Three.js. A shipwrecked sailor climbs storm-lashed
cliffs, wakes the ancient mechanisms buried in the rock, and opens the stone door that
was never meant to be found — then learns that every beacon he lights only calls more
things out of the sea.

## Run

Any static file server works (the game pulls Three.js from a CDN):

```bash
cd saltbound
python3 -m http.server 8000
# or: npx serve .
```

Open http://localhost:8000

## Controls

| Input | Action |
|-------|--------|
| `W A S D` | Move (camera-relative) |
| `Mouse` | Aim |
| `Left click` | Cutlass swing |
| `Q` | Heavy blow (AoE, 5s cooldown) |
| `Space` | Jump |
| `E` | Interact |

## The loop

1. Wake the three hidden mechanisms — the stone gear on the cliff path, the rune
   pressure plate on the plateau, the rusted winch above the beach.
2. The carved stone door opens. Descend into the dungeon.
3. Search the dark: the broken boat is splinters. Light the beacon.
4. The sea answers. Survive waves that never stop scaling — every third wave brings
   something vast.

Cliffs can only be climbed by the winding path. Monsters crawl straight up the rock.
Salvage drops from every kill. Death is certain; the question is only how much you
farm first.

## Structure

- `index.html` — page shell, HUD, title/death screens, styling
- `game.js` — the game: procedural terrain and ocean, player, enemies, combat,
  mechanisms, dungeon, weather, WebAudio synth SFX
