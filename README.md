# Canada map check-in

A study tool for a geography map test: points are marked on a blank map of Canada and you write what each one is.

**Use it:** https://goofturtles.github.io/canada-map-quiz/

It covers 76 points: the provinces and territories, capital cities, five other cities, neighbouring countries, islands, oceans, lakes, seas, bays and gulfs, straits, and rivers.

## Four modes

- **Study** puts the names on the map (zoom in where they get crowded), with a one-line clue for each. Untick "Show names" and click a point to check yourself.
- **Practice** asks one point at a time, by multiple choice or by typing. Anything you miss comes back a few questions later.
- **Place** is the other way round: it asks a question in words ("Which bay cuts into the north of Quebec?") and you type the name and click where it is on the map.
- **Mock test** is the closest to the real thing: numbered points on the map and an answer sheet. Nothing is marked until you hand it in.

There is a dark mode: it follows your device, and the half-moon button at the top switches it.

Typed answers are marked kindly: abbreviations ("BC", "PEI"), short forms ("Superior", "Bear Lake") and small spelling slips all count, as long as it is clear which thing you mean. The full, correctly spelled name is always shown back to you.

## Running it

Use the link above on a laptop or a phone. After the first visit the browser keeps a copy, so it opens with no signal too.

Or download it (Code > Download ZIP) and open `index.html`. There is no build step and nothing is loaded from the web.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `style.css`, `app.js` | The page, its look, and all the behaviour |
| `data.js` | The 76 points: name, position, accepted short forms, clue, and the Place question |
| `rivers.js` | The six rivers on the list, as lines |
| `map.js` | The outline map (generated, do not edit) |
| `sw.js` | Keeps a copy in the browser so the web version opens offline |
| `tools/build-map.js` | Rebuilds `map.js`: `node tools/build-map.js` (this one does need internet) |
| `tools/test-marker.js` | Checks the answer marking: `node tools/test-marker.js` |
| `vendor/` | D3, the Inter font, and their licences (`LICENSES.txt`) |

## Credits

- Map outlines: [Natural Earth](https://www.naturalearthdata.com/) 1:50m and 1:10m (public domain), and [world-atlas](https://github.com/topojson/world-atlas) (ISC).
- [D3](https://d3js.org/) (ISC) draws the map.
- [Inter](https://rsms.me/inter/) (SIL Open Font License), packaged by [Fontsource](https://fontsource.org/).
- The code was written by Claude Code (AI).
