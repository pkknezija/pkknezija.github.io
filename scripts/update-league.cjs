// Dohvat HPS podataka iz izvornog Netlify koda, prilagođen za GitHub Pages.
// Pokreće GitHub Actions; ne treba Netlify.
const fs = require('node:fs');
const path = require('node:path');
const { handler } = require('./league-parser.cjs');

(async function main() {
  const response = await handler();
  if (response.statusCode !== 200) throw new Error(`HPS dohvat nije uspio: ${response.body}`);
  const data = JSON.parse(response.body);
  if (!Array.isArray(data.teams) || data.teams.length === 0 ||
      !data.teams.some(t => t.matches.length > 0 || t.standings.length > 0)) {
    throw new Error('HPS nije vratio korisne rezultate; prethodni league.json ostaje sačuvan.');
  }
  const target = path.join(__dirname, '..', 'league.json');
  if (fs.existsSync(target)) {
    const old = JSON.parse(fs.readFileSync(target, 'utf8'));
    const core = x => JSON.stringify(x.teams);
    if (core(old) === core(data)) {
      console.log('Bez promjena na HPS-u; zadržan prethodni league.json.');
      return;
    }
  }
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
  console.log(`Ažuriran league.json: ${data.teams.length} liga.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
