// Builds map.js, the outline map the app draws, from Natural Earth and world-atlas.
// Run from the project folder:  node tools/build-map.js
// This needs internet. The app does not: it only reads the map.js written here.

const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const d3 = require(path.join(root, 'vendor', 'd3.min.js'));
// rivers.js is a plain browser script, so read its one constant out of it.
const RIVERS = new Function(fs.readFileSync(path.join(root, 'rivers.js'), 'utf8') + '; return RIVERS;')();

// Pinned to exact releases so a rebuild gives the same map.
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/';
const WORLD = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
const FOREIGN = ['840', '643', '304', '352', '666'];   // U.S.A., Russia, Greenland, Iceland, St. Pierre and Miquelon

const get = url => fetch(url).then(r => {
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
});

// world-atlas is TopoJSON: shared, delta-encoded borders ("arcs") that each shape points into.
function countryShapes(topo) {
  const [kx, ky] = topo.transform.scale, [dx, dy] = topo.transform.translate;
  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([a, b]) => [(x += a) * kx + dx, (y += b) * ky + dy]);
  });
  // A ring is a chain of arcs; a negative index means that arc runs backwards.
  const ring = indexes => indexes.reduce((pts, i) => {
    const arc = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    return pts.concat(pts.length ? arc.slice(1) : arc);
  }, []);
  const polygon = rings => rings.map(ring);
  return topo.objects.countries.geometries.filter(g => FOREIGN.includes(String(g.id))).map(g => ({
    id: String(g.id),
    geometry: g.type === 'Polygon'
      ? { type: 'Polygon', coordinates: polygon(g.arcs) }
      : { type: 'MultiPolygon', coordinates: g.arcs.map(polygon) },
  }));
}

// Three decimals of a degree is about 100 m, far finer than the 1:50m source.
const round = n => Math.round(n * 1000) / 1000;
function tidy(coords) {
  if (typeof coords[0] === 'number') return coords.slice(0, 2).map(round);
  const out = coords.map(tidy);
  // Rounding can make neighbouring points identical; drop the repeats.
  return typeof out[0][0] === 'number' ? out.filter((p, i) => !i || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1]) : out;
}
const slim = geometry => ({ type: geometry.type, coordinates: tidy(geometry.coordinates) });

const nearCanada = f => { const [lon, lat] = d3.geoCentroid(f); return lat > 38 && lon > -179 && lon < -40; };

(async () => {
  const [world, admin1, lakes, rivers] = await Promise.all([
    get(WORLD),
    get(NE + 'ne_50m_admin_1_states_provinces.geojson'),
    get(NE + 'ne_50m_lakes.geojson'),
    get(NE + 'ne_50m_rivers_lake_centerlines.geojson'),
  ]);

  const map = {
    countries: countryShapes(world).map(c => ({ id: c.id, geometry: slim(c.geometry) })),
    provinces: admin1.features.filter(f => f.properties.iso_a2 === 'CA')
      .map(f => ({ code: f.properties.iso_3166_2, geometry: slim(f.geometry) })),
    lakes: lakes.features.filter(nearCanada).map(f => ({ name: f.properties.name, geometry: slim(f.geometry) })),
    // Other rivers stay on the map as plain lines, so the six on the list don't stand out by being the only ones.
    // The listed ones are drawn from rivers.js instead; the longitude test keeps Labrador's Churchill River.
    rivers: rivers.features.filter(f => f.geometry && f.properties.featurecla === 'River' && nearCanada(f)
      && !(f.properties.name in RIVERS && d3.geoCentroid(f)[0] < -70)).map(f => slim(f.geometry)),
  };

  // A ring wound the wrong way would make d3 fill the whole globe, so check before writing.
  for (const shape of [...map.countries, ...map.provinces, ...map.lakes]) {
    if (d3.geoArea(shape.geometry) > 2 * Math.PI) throw new Error('inside-out shape: ' + (shape.id || shape.code || shape.name));
  }
  if (map.countries.length !== FOREIGN.length || map.provinces.length !== 13) throw new Error('missing countries or provinces');

  const header = '// The outline map. Written by tools/build-map.js; edit that, not this.\n'
    + '// Provinces, lakes and rivers: Natural Earth 1:50m, v5.1.2 (public domain). Countries: world-atlas 2.0.2 (Natural Earth).\n';
  fs.writeFileSync(path.join(root, 'map.js'), header + 'const MAP = ' + JSON.stringify(map) + ';\n');
  const count = c => typeof c[0] === 'number' ? 1 : c.reduce((n, x) => n + count(x), 0);
  const points = list => list.reduce((n, s) => n + count((s.geometry || s).coordinates), 0);
  console.log(`map.js written: ${map.countries.length} countries (${points(map.countries)} points), ${map.provinces.length} provinces (${points(map.provinces)}), `
    + `${map.lakes.length} lakes (${points(map.lakes)}), ${map.rivers.length} rivers (${points(map.rivers)})`);
})().catch(err => { console.error(err.message); process.exit(1); });
