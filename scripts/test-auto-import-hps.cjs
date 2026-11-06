const assert=require('node:assert/strict');
const {idsFromHtml,titleOfPage,matchingGame,parseIndividual,applyImport}=require('./auto-import-hps.cjs');
const teams={home:'DARTS POINT TEAM BAN',away:'KNEŽIJA DRINKING DWARVES',team:'KNEŽIJA DRINKING DWARVES',label:'1. liga',round:7,hs:15,as:1,date:'2026-11-05T19:00:00+01:00'};
const playerSets=[
 [['Marko Paternost',2,'Domagoj Talan',0],['Neven Rešetar',2,'Ante Radeljić',1],['Dean Biškupić',2,'Andro Gerić',0],['Toni Samaržija',2,'Goran Cikoš',0]],
 [['Marko Paternost',2,'Andro Gerić',1],['Neven Rešetar',2,'Goran Cikoš',0],['Dean Biškupić',2,'Domagoj Talan',1],['Toni Samaržija',2,'Ante Radeljić',1]],
 [['Marko Paternost',2,'Goran Cikoš',0],['Davor Biškupić',1,'Andro Gerić',2],['Dean Biškupić',2,'Ante Radeljić',1],['Toni Samaržija',2,'Domagoj Talan',0]],
 [['Marko Paternost',2,'Ante Radeljić',1],['Davor Biškupić',2,'Domagoj Talan',0],['Željko Grubišić',2,'Bruno Šukara',1],['Toni Samaržija',2,'Andro Gerić',0]]
];
const html='<html><body><h1>7. kolo DARTS POINT TEAM BAN - KNEŽIJA DRINKING DWARVES</h1>'+ playerSets.map((round,r)=>`<h2>Krug ${r+1}</h2>`+round.map(([a,sa,b,sb])=>`<div><a>${a}</a><span>${sa}</span><a>${b}</a><span>${sb}</span></div>`).join('')).join('')+'</body></html>';
assert.deepEqual(idsFromHtml('<a href="/event/exlupuqv/bracket">zapisnik</a>'),['exlupuqv']);
assert.equal(matchingGame(titleOfPage(html),[teams]),teams);
const rows=parseIndividual(html,teams,'exlupuqv');
assert.equal(rows.length,16);
const head=rows.find(x=>x.p==='Andro Gerić'&&x.o==='Dean Biškupić');
assert.equal(head.a,0);assert.equal(head.b,2);
const base=[];
assert.deepEqual(applyImport(base,rows),{added:16,updated:0,already:0});
assert.deepEqual(applyImport(base,rows),{added:0,updated:0,already:16});
assert.equal(base.length,16);
assert.throws(()=>parseIndividual(html.replace('Toni Samaržija</a><span>2','Toni Samaržija</a><span>1'),teams,'exlupuqv'));
console.log('OK: 16 mečeva, H2H, nema duplikata, provjera ukupnog rezultata.');
