// Jednokratni PROBNI uvoz 16 pojedinačnih mečeva iz HPS zapisnika exlupuqv.
// Izvor: https://hps-dart.hr/event/exlupuqv (provjereno 2026-11-06).
// NE dohvaća automatski buduće utakmice. To je sljedeći korak nakon provjere.
const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'..','matches.json');
const rows=JSON.parse(fs.readFileSync(file,'utf8'));
if(!Array.isArray(rows))throw Error('matches.json nije polje mečeva');
// Redoslijed je točan redoslijed 16 susreta na HPS-u; rezultati su gledani iz perspektive Knežije.
const games=[
['Domagoj Talan','Marko Paternost',0,2],
['Ante Radeljić','Neven Rešetar',1,2],
['Andro Gerić','Dean Biškupić',0,2],
['Goran Cikoš','Toni Samaržija',0,2],
['Andro Gerić','Marko Paternost',1,2],
['Goran Cikoš','Neven Rešetar',0,2],
['Domagoj Talan','Dean Biškupić',1,2],
['Ante Radeljić','Toni Samaržija',1,2],
['Goran Cikoš','Marko Paternost',0,2],
['Andro Gerić','Davor Biškupić',2,1],
['Ante Radeljić','Dean Biškupić',1,2],
['Domagoj Talan','Toni Samaržija',0,2],
['Ante Radeljić','Marko Paternost',1,2],
['Domagoj Talan','Davor Biškupić',0,2],
['Bruno Šukara','Željko Grubišić',1,2],
['Andro Gerić','Toni Samaržija',0,2]
];
const normalize=x=>String(x||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('hr');
let added=0,skipped=0;
for(const [i,g] of games.entries()){
 const [p,o,a,b]=g;
 const match={s:'2026/27',l:'1. liga',h:'gosti',t:'Knežija Drinking Dwarves',p,c:'Darts Point Team Ban',o,a,b,m:`hps:exlupuqv:${i+1}`,d:'2026-11-05'};
 // Provjera i po ID-u i po stvarnim poljima, da ne udvostručimo ručno unesen meč.
 const duplicate=rows.some(x=>x.m===match.m || (x.d===match.d && normalize(x.p)===normalize(p) && normalize(x.o)===normalize(o) && Number(x.a)===a && Number(x.b)===b && normalize(x.c)===normalize(match.c)));
 if(duplicate){skipped++;continue;}
 rows.push(match);added++;
}
fs.writeFileSync(file,JSON.stringify(rows)+'\n');
console.log(`Probni uvoz: dodano ${added}, preskočeno ${skipped}; ukupno ${rows.length} mečeva.`);
