# Canada map check-in

A study tool for a geography map test: points are marked on a blank map of Canada and you write what each one is.

**Use it:** https://goofturtles.github.io/canada-map-quiz/

It covers 76 points: the provinces and territories, capital cities, five other cities, neighbouring countries, islands, oceans, lakes, seas, bays and gulfs, straits, and rivers.

## Three modes

- **Study** puts the names on the map (zoom in where they get crowded), with a one-line clue for each. Untick "Show names" and click a point to check yourself.
- **Practice** asks one point at a time, by multiple choice or by typing. Anything you miss comes back a few questions later.
- **Mock test** is the closest to the real thing: numbered points on the map and an answer sheet. Nothing is marked until you hand it in.

Spelling counts in typed answers. Capital letters, accents, full stops and apostrophes are forgiven; letters are not.

## Running it

Use the link above on a laptop or a phone; it needs a connection to load.

To use it with no internet, download this folder and open `index.html`. There is no build step and nothing is loaded from the web.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `style.css`, `app.js` | The page, its look, and all the behaviour |
| `data.js` | The 76 points: name, position, accepted short forms, clue |
| `rivers.js` | The six rivers on the list, as lines |
| `map.js` | The outline map (generated, do not edit) |
| `tools/build-map.js` | Rebuilds `map.js`: `node tools/build-map.js` (this one does need internet) |
| `vendor/` | D3, the Inter font, and their licences (`LICENSES.txt`) |

## Credits

- Map outlines: [Natural Earth](https://www.naturalearthdata.com/) 1:50m and 1:10m (public domain), and [world-atlas](https://github.com/topojson/world-atlas) (ISC).
- [D3](https://d3js.org/) (ISC) draws the map.
- [Inter](https://rsms.me/inter/) (SIL Open Font License), packaged by [Fontsource](https://fontsource.org/).
- The code was written by Claude Code (AI).
