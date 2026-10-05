export function mapSnapshot() {
  const w=window;
  const canvas=document.querySelector('#canvas');
  if (!canvas || !w.g_performance || !w.m_all || !w.m || !w.k_all || !Number.isFinite(w.zoom) || w.zoom<=0 || w.animacia || !w.zobrazene_miesta) return null;
  const seats=Object.values(w.m_all).filter(Array.isArray).map(s=>({id:s[0],number:String(s[1]).trim(),row:String(s[2]).trim(),sector:s[7],x:s[4],y:s[5],price:Number(w.k_all[s[3]]?.[2]),available:s[1]!=='' && s[1]!=='|N|' && w.m[s[0]]?.[1]===0 && !w.g_performance.Resale?.Seats?.[s[0]] && !w.g_performance.SpecialSeatsDescription?.[s[0]] && w.nMiestSektor?.[s[7]]!==1}));
  const basket=Object.values(w.Basket||{}).flat().map(s=>({id:s.ID_Miesto_Javisko,performance:s.id_predstavenie,price:Number(s.Cena)}));
  const rect=canvas.getBoundingClientRect();
  return {seats,basket,zoom:w.zoom,px:w.poz_x,py:w.poz_y,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},performance:w.g_performance.ID};
}
