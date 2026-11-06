// Dohvaća poredak i raspored s hps-dart.hr za tri ekipe PK Knežija.
const BASE = "https://hps-dart.hr/site/uniondivision/UnionLeagueTable?unionId=2&seasonId=26&leagueId=";
const TEAMS = [
  { name: "KNEŽIJA DRINKING DWARVES", label: "1. liga", leagueId: 815 },
  { name: "KNEŽIJA UNITED", label: "4. liga, skupina C", leagueId: 832 },
  { name: "FAKINI KNEŽIJA", label: "4. liga, skupina A", leagueId: 830 },
];
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
function zagrebOffset(y, m, d) {
  let dst;
  if (m < 3 || m > 10) dst = false;
  else if (m > 3 && m < 10) dst = true;
  else {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lastSun = last - new Date(Date.UTC(y, m - 1, last)).getUTCDay();
    dst = m === 3 ? d >= lastSun : d < lastSun;
  }
  return dst ? "+02:00" : "+01:00";
}
const p2 = (n) => String(n).padStart(2, "0");
function parseStandings(html) {
  const out = [], re = /<span class="pos[^"]*">(\d+)<\/span>[\s\S]*?<span class="crew"[^>]*>([^<]*)<\/span>[\s\S]*?<td class="pts">(\d+)<\/td>\s*<td>(\d+)<\/td>/g;
  let m;
  while ((m = re.exec(html))) out.push({ pos: +m[1], name: norm(m[2]), pts: +m[3], played: +m[4] });
  return out;
}
function parseMatches(html) {
  const out = [], re = /<b>(\d+)\. kolo<\/b>|<div class="table-game-row">([\s\S]*?)(?=<div class="table-game-row">|<div class="thead">|$)/g;
  let round = 0, m;
  while ((m = re.exec(html))) {
    if (m[1]) { round = +m[1]; continue; }
    const b = m[2] || "";
    const d = /<div class="date">(\d+)\.(\d+)\.(\d+)\. (\d+):(\d+)/.exec(b);
    const h = /class="team home">[\s\S]*?<span>([^<]*)<\/span>/.exec(b);
    const a = /class="team away">[\s\S]*?<span>([^<]*)<\/span>/.exec(b);
    const s = /<span class="home">(\d+)<\/span> : <span class="away">(\d+)<\/span>/.exec(b);
    if (!d || !h || !a) continue;
    const [y, mo, da] = [+d[3], +d[2], +d[1]];
    const hs = s ? +s[1] : 0, as = s ? +s[2] : 0;
    out.push({
      round, home: norm(h[1]), away: norm(a[1]), hs, as, played: hs + as > 0,
      date: `${y}-${p2(mo)}-${p2(da)}T${p2(d[4])}:${d[5]}:00${zagrebOffset(y, mo, da)}`,
    });
  }
  return out;
}
async function league(id) {
  const r = await fetch(BASE + id, { headers: { "User-Agent": "PK-Knezija-site", Accept: "application/json" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  return { standings: parseStandings(j.html || ""), matches: parseMatches(j.html || "") };
}
exports.parseStandings = parseStandings;
exports.parseMatches = parseMatches;
exports.handler = async () => {
  try {
    const teams = await Promise.all(TEAMS.map(async (t) => {
      const l = await league(t.leagueId);
      const mine = l.matches.filter((m) => m.home === t.name || m.away === t.name);
      return { name: t.name, label: t.label, standings: l.standings, matches: mine };
    }));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" },
      body: JSON.stringify({ updated: new Date().toISOString(), teams }),
    };
  } catch (e) {
    return { statusCode: 502, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
