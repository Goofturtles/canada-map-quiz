// Checks the answer marking by running the app's own marker over lists of answers.
// Run from anywhere:  node tools/test-marker.js      It prints one summary line and exits 1 if anything failed.

const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

// data.js and app.js are plain browser scripts, so load the data and cut the marker out of app.js.
(0, eval)(read('data.js') + ';globalThis.CATS=CATS;globalThis.ITEMS=ITEMS;');
const app = read('app.js');
(0, eval)(app.slice(app.indexOf('// Capitals, accents'), app.indexOf('// ── Saved progress')) + ';globalThis.judge=judge;');

const by = id => ITEMS.find(it => it.id === id);
let fails = 0;
// want: 'right' (exact), 'ok' (gets the mark) or 'wrong'
const expect = (id, typed, want) => {
  const got = judge(by(id), typed);
  if (want === 'ok' ? got !== 'wrong' : got === want) return;
  fails++;
  console.log('FAIL', id, JSON.stringify(typed), 'got', got, 'want', want);
};

// 1. Every exact name, in any case and without its punctuation, is right.
for (const it of ITEMS) for (const v of [it.name, it.name.toUpperCase(), it.name.toLowerCase(), it.name.replace(/[.']/g, '')]) expect(it.id, v, 'right');

// 2. Inside one group, no other point's name or accepted form may be taken for this one.
for (const it of ITEMS) for (const o of ITEMS) {
  if (o.name === it.name || o.cat !== it.cat) continue;
  for (const form of [o.name, ...(o.also || [])]) expect(it.id, form, 'wrong');
}

// 3. Across groups, another point's full name only counts where it is this point's own short form.
const SHARED = ['Quebec City <- Quebec', 'Victoria Island <- Victoria', 'Vancouver Island <- Vancouver', 'Lake Winnipeg <- Winnipeg', 'Lake Ontario <- Ontario', 'Ottawa River <- Ottawa'];
for (const it of ITEMS) for (const o of ITEMS) {
  if (o.name === it.name || o.cat === it.cat || judge(it, o.name) === 'wrong' || SHARED.includes(it.name + ' <- ' + o.name)) continue;
  fails++;
  console.log('FAIL', it.name, 'accepts', o.name);
}

// 4. Abbreviations, short forms and small spelling slips get the mark.
const OK = [['bc', 'BC'], ['bc', 'B.C.'], ['pe', 'PEI'], ['pe', 'P.E.I.'], ['sk', 'Sask'], ['nt', 'NWT'], ['nl', 'Newfoundland'], ['nl', 'NL'], ['yt', 'Yukon Territory'],
  ['great-bear', 'Bear'], ['great-bear', 'Bear Lake'], ['great-bear', 'Great Bear'], ['great-bear', 'Great Bear L.'], ['great-slave', 'Slave Lake'], ['great-slave', 'great slave'],
  ['superior', 'Superior'], ['superior', 'L. Superior'], ['huron', 'Huron'], ['erie', 'L. Erie'], ['lake-winnipeg', 'Winnipeg'], ['lake-ontario', 'Ontario'],
  ['fraser', 'Fraser'], ['fraser', 'Fraser R.'], ['mackenzie', 'McKenzie River'], ['ottawa-river', 'Ottawa'], ['ottawa-river', 'Ottawa R.'], ['st-lawrence', 'St Lawrence'], ['st-lawrence', 'Saint Lawrence River'],
  ['gulf-st-lawrence', 'St. Lawrence'], ['gulf-alaska', 'Alaska'], ['fundy', 'Fundy'], ['hudson-bay', 'Hudson'], ['hudson-bay', 'Hudsons Bay'], ['hudson-strait', 'Hudson'], ['hudson-strait', 'Hudson Straight'], ['bering', 'Bering Str.'],
  ['sk', 'Saskatchewen'], ['winnipeg', 'Winnepeg'], ['fredericton', 'Frederickton'], ['iqaluit', 'Iqualuit'], ['charlottetown', 'Charlotetown'], ['manitoulin', 'Manatoulin'], ['athabasca', 'Athabaska'],
  ['ellesmere', 'Ellesmer'], ['nu', 'Nunavit'], ['ns', 'Novia Scotia'], ['halifax', 'Hailfax'], ['regina', 'Regnia'], ['bc', 'British Colombia'], ['nt', 'Northwest Territory'],
  ['greenland', 'Greenland'], ['greenland', 'Denmark'], ['spm', 'France'], ['spm', 'St Pierre and Miquelon'], ['usa', 'USA'], ['usa', 'U.S.'], ['usa', 'America'], ['usa', 'United States'],
  ['usa-alaska', 'Alaska'], ['usa-alaska', 'USA'], ['usa-alaska', 'Alaska, United States'],
  ['quebec-city', 'Quebec'], ['st-johns', 'St Johns'], ['victoria-island', 'Victoria'], ['vancouver-island', 'Vancouver'], ['vancouver-island', 'Vancouver Is.'], ['baffin', 'Baffin Is.'],
  ['cape-breton', 'Cape Breton'], ['haida-gwaii', 'Hada Gwaii'], ['labrador-sea', 'Labrador'], ['beaufort', 'Beaufort'], ['arctic', 'Arctic'], ['pacific', 'Pacific Oc.'], ['thunder-bay', 'Thunder Bay']];
for (const [id, typed] of OK) expect(id, typed, 'ok');

// 5. A different place, or the wrong kind of thing, is still wrong.
const WRONG = [['hudson-bay', 'Hudson Strait'], ['hudson-strait', 'Hudson Bay'], ['hudson-strait', 'Hudson B.'], ['hudson-bay', 'Lake Huron'], ['hudson-bay', 'Huron'], ['huron', 'Hudson'],
  ['on', 'Lake Ontario'], ['on', 'L. Ontario'], ['toronto', 'Ontario'], ['ab', 'Edmonton'], ['edmonton', 'Calgary'], ['calgary', 'Edmonton'], ['lake-ontario', 'Lake Erie'],
  ['churchill', 'Nelson'], ['nelson', 'Churchill'], ['great-bear', 'Great Slave'], ['great-bear', 'Slave'], ['great-slave', 'Bear'], ['atlantic', 'Arctic'], ['atlantic', 'Pacific'],
  ['labrador-sea', 'Beaufort'], ['davis', 'Bering'], ['nu', 'Yukon'], ['nb', 'NS'], ['ns', 'NL'], ['ns', 'NB'], ['nt', 'NU'], ['banks', 'Baffin'],
  ['vancouver-island', 'Victoria'], ['victoria', 'Vancouver'], ['victoria', 'Victoria Island'], ['vancouver', 'Vancouver Island'], ['vancouver', 'Vancouver I.'],
  ['sk', 'Saskatoon'], ['saskatoon', 'Sask'], ['regina', 'Saskatoon'], ['qc', 'Quebec City'], ['winnipeg', 'Lake Winnipeg'], ['winnipeg', 'L. Winnipeg'], ['ottawa', 'Ottawa River'], ['ottawa', 'Ottawa R.'],
  ['st-lawrence', 'Gulf of St. Lawrence'], ['gulf-st-lawrence', 'St. Lawrence River'], ['gulf-st-lawrence', 'St. Lawrence R.'], ['superior', 'Lake'], ['great-bear', 'Great Lake'],
  ['bc', ''], ['bc', '   '], ['usa', 'Canada'], ['usa', 'Alaska'], ['russia', 'USA'], ['iceland', 'Greenland'], ['mb', 'Manitoulin'], ['on', 'Ottawa'], ['pe', 'Charlottetown'], ['halifax', 'Nova Scotia']];
for (const [id, typed] of WRONG) expect(id, typed, 'wrong');

console.log(`${ITEMS.length} points | ${OK.length} lenient answers | ${WRONG.length} wrong answers | failures: ${fails}`);
process.exit(fails ? 1 : 0);
