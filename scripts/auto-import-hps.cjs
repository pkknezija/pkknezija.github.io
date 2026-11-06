'use strict';
/**
 * PK Knežija: conservative HPS individual match importer.
 * Only imports a verified 16-singles round robin whose team score matches league.json.
 * Uses NO API keys and changes ONLY matches.json. Run via GitHub Actions.
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://hps-dart.hr';
const SITE = `${BASE}/ps-grad-zagreb`;
const MATCH_FILE = path.join(ROOT, 'matches.json');
const LEAGUE_FILE = path.join(ROOT, 'league.json');
const dry = process.argv.includes('--dry-run');
const norm = x => String(x ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleUpperCase('hr');
const clean = x => String(x ?? '').replace(/\s+/g, ' ').trim();
const safeHtml = x => String(x).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ').replace(/<!--[^]*?-->/g,' ');
const ent = s => String(s).replace(/&(?:nbsp|amp|quot|apos|lt|gt|#(\d+)|#x([0-9a-f]+));/gi, (whole,dec,hex)=>dec?String.fromCodePoint(+dec):hex?String.fromCodePoint(parseInt(hex,16)):({ '&nbsp;':' ', '&amp;':'&', '&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>' })[whole.toLowerCase()]||whole);
const strip = s => clean(ent(String(s).replace(/<[^>]*>/g,' ')));
function tokens(html) {
 const s=safeHtml(html).replace(/<(?:br|\/p|\/div|\/li|\/a|\/span|\/h\d|\/td|\/tr|\/strong|\/b)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ');
 return ent(s).split(/\n/).map(clean).filter(Boolean);
}
function idsFromHtml(html){
 const s=safeHtml(html); const ids = new Set();
 // Full links and relative URLs in markup and script-escaped attributes.
 for(const m of s.matchAll(/(?:\\\/|\/|%2F)event(?:\\\/|\/|%2F)([a-z0-9]{6,16})(?=[\/?#"'\\\s&]|$)/gi)) ids.add(m[1].toLowerCase());
 return [...ids];
}
async function get(url){
 for(let attempt=1;attempt<=3;attempt++){
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),15000);
  try {const r=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'PK-Knezija-HPS-sync/1.0 (+https://pkknezija.github.io/)','Accept':'text/html,application/json'}});
   if(!r.ok)throw Error(`HTTP ${r.status} ${url}`);
   return await r.text();
  } catch(e){if(attempt===3) throw e;await new Promise(res=>setTimeout(res,attempt*1300));} finally{clearTimeout(t);}
 }
}
function expectedGames(league){
 const out=[];
 for(const team of league.teams || []) {
  for(const g of team.matches || []){
   if(!g.played || (!g.hs && !g.as)) continue;
   // avoid duplicate if same match appears for two club teams
   const key=[norm(g.home),norm(g.away),String(g.date).slice(0,10)].join('|');
   if(out.some(x=>x.key===key))continue;
   out.push({key, ...g, team:team.name, label:team.label});
  }
 }
 return out;
}
function seasonFromDate(date){const y=Number(String(date).slice(0,4)),m=Number(String(date).slice(5,7));return m>=7?`${y}/${String(y+1).slice(2)}`:`${y-1}/${String(y).slice(2)}`;}
function matchingGame(title,expected){
 const t=norm(title);
 // restrict candidates to exact pairing (rather than guessing from a team name)
 const list=expected.filter(g=>t.includes(norm(g.home)) && t.includes(norm(g.away)) && t.indexOf(norm(g.home))<t.indexOf(norm(g.away)));
 const round=/\b(\d{1,2})\.\s*KOLO\b/.exec(t);
 const byRound=round?list.filter(g=>Number(g.round)===Number(round[1])):list;
 return byRound.length===1?byRound[0]:null;
}
function titleOfPage(html){
 const h=/\<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
 if(h) return strip(h[1]);
 const title=/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
 return title?strip(title[1]):'';
}
function parseIndividual(html,game,id){
 const ts=tokens(html);
 // Locate the first "Krug 1"; only read game lines up to end of "Krug 4".
 const starts=[];
 for(let i=0;i<ts.length;i++) if(/^Krug\s+[1-4]$/i.test(ts[i]))starts.push(i);
 if(starts.length!==4 || ![1,2,3,4].every((n,i)=>/^Krug\s+/i.test(ts[starts[i]]) && Number(ts[starts[i]].match(/\d+/)[0])===n))
  throw Error(`${id}: nedostaju sva četiri kruga (pronađeno ${starts.length}); preskačem nesiguran zapisnik`);
 let matches=[];
 for(let r=0;r<4;r++){
  const section=ts.slice(starts[r]+1,r===3?Math.min(ts.length,starts[r]+100):starts[r+1]);
  // Player name and result are consecutive visible text tokens in public HPS report.
  // Strictly demand four pairs per round; never write incomplete result.
  let games=[];
  for(let i=0;i+3<section.length && games.length<4;i++) {
   const [a,as,b,bs]=section.slice(i,i+4);
   if(!/^[01-2]$/.test(as) || !/^[01-2]$/.test(bs))continue;
   if(!/\p{L}/u.test(a)||!/\p{L}/u.test(b) || a.length>75 || b.length>75 || norm(a)===norm(b)) continue;
   if(Math.max(+as,+bs)!==2 || +as===+bs)continue;
   games.push({homePlayer:a,awayPlayer:b,homeScore:+as,awayScore:+bs});i+=3;
  }
  if(games.length!==4)throw Error(`${id}: krug ${r+1} ima ${games.length} od očekivana 4 susreta`);
  matches.push(...games);
 }
 if(matches.length!==16)throw Error(`${id}: nije pronađeno 16 pojedinačnih mečeva`);
 // HPS rows list the home team first; verify accumulated winners against team score.
 const winsHome=matches.filter(x=>x.homeScore>x.awayScore).length,winsAway=16-winsHome;
 // Some team meetings have a decisive doubles game, which we deliberately exclude.
 const sum=Number(game.hs)+Number(game.as);
 const verified=sum===16 ? winsHome===Number(game.hs)&&winsAway===Number(game.as) :
  sum===17 && ((Number(game.hs)-winsHome===1 && Number(game.as)===winsAway)||(Number(game.as)-winsAway===1&&Number(game.hs)===winsHome));
 if(!verified) throw Error(`${id}: zbroj pojedinačnih pobjeda ${winsHome}:${winsAway} ne odgovara ligaškom rezultatu ${game.hs}:${game.as}`);
 const isHome=norm(game.home)===norm(game.team);
 const opponent=isHome?game.away:game.home;
 return matches.map((m,i)=>({
  s: seasonFromDate(game.date),l:game.label,h:isHome?'doma':'gosti',t:clean(game.team),
  p:isHome?m.homePlayer:m.awayPlayer,c:clean(opponent),o:isHome?m.awayPlayer:m.homePlayer,
  a:isHome?m.homeScore:m.awayScore,b:isHome?m.awayScore:m.homeScore,
  m:`hps:${id}:${i+1}`,d:String(game.date).slice(0,10)
 }));
}
function equivalent(row,item){return String(row.d)===item.d && norm(row.p)===norm(item.p) && norm(row.o)===norm(item.o) && norm(row.c)===norm(item.c) && +row.a===item.a && +row.b===item.b;}
function applyImport(rows,candidates){
 let added=0,updated=0,already=0;
 for(const item of candidates){
  const found=rows.findIndex(r=>r.m===item.m);
  if(found>=0){
   if(JSON.stringify(rows[found])!==JSON.stringify({...rows[found],...item})){
    rows[found]={...rows[found],...item};updated++;
   }else already++;
  }else if(rows.some(row=>equivalent(row,item)))already++;
  else {rows.push(item);added++;}
 }
 return {added,updated,already};
}
async function run(){
 const league=JSON.parse(fs.readFileSync(LEAGUE_FILE,'utf8'));
 const existing=JSON.parse(fs.readFileSync(MATCH_FILE,'utf8'));
 if(!Array.isArray(existing))throw Error('matches.json nije polje');
 const expected=expectedGames(league);
 const latestDays=Math.max(14,Math.min(180,Number(process.env.HPS_LOOKBACK_DAYS||65)));
 const since=Date.now()-latestDays*86400000;
 const recent=expected.filter(g=>new Date(g.date).getTime()>=since && new Date(g.date).getTime()<=Date.now()+86400000);
 if(recent.length===0){console.log('Nema nedavnih završenih utakmica u league.json.');return;}
 console.log(`Poznate završene utakmice u posljednjih ${latestDays} dana: ${recent.length}`);
 const discovered=new Set();
 // Public union page contains recent completed match links. No authentication needed.
 const site=await get(SITE);
 for(const id of idsFromHtml(site))discovered.add(id);
 // Bonus: league table HTML sometimes contains event links for older matches.
 const ids=[815,832,830];
 for(const lid of ids){
  try{const str=await get(`${BASE}/site/uniondivision/UnionLeagueTable?unionId=2&seasonId=26&leagueId=${lid}`);
   const obj=JSON.parse(str);for(const id of idsFromHtml(obj.html||str))discovered.add(id);
  }catch(e){console.warn(`Nije dostupna stranica lige ${lid}: ${e.message}`);}
 }
 console.log(`Otkriveno ${discovered.size} javnih HPS zapisnika`);
 if(discovered.size===0)throw Error('Nije pronađena nijedna HPS poveznica na zapisnik; ništa nije zapisano.');
 let totalAdd=0,totalUpdate=0,totalSkip=0,recognized=0;const errors=[];
 for(const id of discovered){
  try{
   const html=await get(`${BASE}/event/${id}`);
   const title=titleOfPage(html);
   const game=matchingGame(title,recent);
   if(!game)continue;
   recognized++;
   const records=parseIndividual(html,game,id);
   const result=applyImport(existing,records);
   totalAdd+=result.added;totalUpdate+=result.updated;totalSkip+=result.already;
   console.log(`${id}: ${game.home} - ${game.away}: +${result.added}, ažurirano ${result.updated}, preskočeno ${result.already}`);
  }catch(err){errors.push(err.message);console.error(err.message);}
 }
 console.log(`Obrađeno ${recognized} utakmica; novih ${totalAdd}, ispravljenih ${totalUpdate}, preskočenih ${totalSkip}`);
 if(errors.length)throw Error(`${errors.length} zapisnika nisu pouzdano obrađena; datoteka NIJE promijenjena.`);
 if(!recognized) throw Error('Nije pronađen nijedan zapisnik koji se poklapa s league.json; ništa nije zapisano.');
 if(totalAdd||totalUpdate){
  if(dry)console.log(`PROBNA PROVJERA: ${totalAdd} dodataka i ${totalUpdate} promjena, bez zapisivanja.`);
  else {fs.writeFileSync(MATCH_FILE,JSON.stringify(existing)+'\n');console.log(`Sigurno ažuriran matches.json; sada ${existing.length} zapisa.`);}
 } else console.log('Nema novih podataka. matches.json nije promijenjen.');
}
if(require.main===module)run().catch(err=>{console.error('HPS automatski uvoz:',err.message);process.exitCode=1});
module.exports={tokens,idsFromHtml,titleOfPage,matchingGame,parseIndividual,applyImport};
