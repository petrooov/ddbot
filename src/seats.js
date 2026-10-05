export function choosePair(seats, allowSeparate=true, maxPrice=640, requiredId) {
  const free=seats.filter(s=>s.available && Number.isFinite(s.price) && s.price<=maxPrice && s.price>0 && Number.isFinite(s.x) && Number.isFinite(s.y) && /^\d+$/.test(String(s.number)));
  const rows=new Map();
  for(const s of seats){const key=`${s.sector}|${s.row}`;if(!rows.has(key))rows.set(key,[]);rows.get(key).push(s);}
  const geometry=new Map();
  for(const [key,row] of rows){const xs=row.map(s=>s.x).filter(Number.isFinite).sort((a,b)=>a-b);const gaps=xs.slice(1).map((x,i)=>x-xs[i]).filter(x=>x>0).sort((a,b)=>a-b);geometry.set(key,{center:(xs[0]+xs.at(-1))/2,spacing:gaps[Math.floor(gaps.length/2)]||1});}
  const pairs=[];
  for(let i=0;i<free.length;i++)for(let j=i+1;j<free.length;j++){
    const a=free[i],b=free[j];if(requiredId!==undefined && a.id!==requiredId && b.id!==requiredId)continue;
    const sameRow=a.sector===b.sector && a.row===b.row;
    const ga=geometry.get(`${a.sector}|${a.row}`),gb=geometry.get(`${b.sector}|${b.row}`);
    const adjacent=sameRow && Math.abs(Number(a.number)-Number(b.number))===1 && Math.abs(a.y-b.y)<ga.spacing/2 && Math.abs(a.x-b.x)<=ga.spacing*1.35;
    if(!adjacent&&!allowSeparate)continue;
    const middle=Math.abs((a.x+b.x)/2-ga.center)/ga.spacing;
    const centrality=sameRow?middle:Math.abs(a.x-ga.center)/ga.spacing+Math.abs(b.x-gb.center)/gb.spacing;
    const score=(adjacent?0:1000000)+(sameRow?0:100000)+((Number(a.row)||99)+(Number(b.row)||99))*1000+centrality*20+Math.abs(a.x-b.x)/ga.spacing;
    pairs.push({seats:[a,b].sort((x,y)=>Math.abs(x.x-geometry.get(`${x.sector}|${x.row}`).center)-Math.abs(y.x-geometry.get(`${y.sector}|${y.row}`).center)||Number(x.number)-Number(y.number)),adjacent,score});
  }
  pairs.sort((a,b)=>a.score-b.score);return pairs[0]||null;
}
