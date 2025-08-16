(function(){
  const qs = new URLSearchParams(location.search);
  const apiBase = (qs.get('api')||'').replace(/\/$/,'');
  let gameId = qs.get('gameId') || null;

  const info = document.getElementById('info');
  const err  = document.getElementById('err');

  function showErr(t){ if(err){ err.textContent = t; err.style.display='inline-block'; } }
  function clearErr(){ if(err) err.style.display='none'; }
  if(!apiBase){ showErr('Puuttuu ?api=...'); return; }

  function api(path){ return apiBase + path; }
  async function fetchJson(url){
    const r = await fetch(url, { mode:'cors' });
    const txt = await r.text();
    if(!r.ok) throw new Error(txt || ('HTTP '+r.status));
    if(!txt.trim()) return null;
    try { return JSON.parse(txt); } catch { return null; }
  }
  function esc(s){ return (s??'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  // Leaflet
  const map = L.map('map', { zoomControl:true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap -tekijät'
  }).addTo(map);
  const markers = L.layerGroup().addTo(map);
  let areaLayer = null;

  map.setView([60.1699, 24.9384], 12);

  async function pickLatestGame(){
    if(gameId) return;
    const list = await fetchJson(api('/games'));
    if(Array.isArray(list) && list.length){
      gameId = list[0].id || list[0].Id;
    }else{
      throw new Error('Pelejä ei löytynyt (adminissa luotava peli).');
    }
  }

  async function loadArea(){
    try{
      const feat = await fetchJson(api(`/games/${gameId}/area`));
      if(!feat || !feat.geometry || feat.geometry.type!=='Polygon') return;
      // GeoJSON käyttää [lon,lat] – muutetaan Leafletiin [lat,lon]
      const pts = (feat.geometry.coordinates?.[0]||[]).map(([lon,lat])=>[lat,lon]);
      if(areaLayer){ map.removeLayer(areaLayer); areaLayer=null; }
      areaLayer = L.polygon(pts, { color:'#60a5fa', weight:2, fillOpacity:0.08 }).addTo(map);
      map.fitBounds(areaLayer.getBounds().pad(0.2));
    }catch(e){
      // 404 = ei tallennettua aluetta → ei virheilmoitusta
    }
  }

  async function loadAndRender(){
    clearErr();
    if(!gameId) return;
    const game  = await fetchJson(api(`/games/${gameId}`));
    const flags = await fetchJson(api(`/games/${gameId}/flags`)) || [];
    const teams = (game?.teams) || [];

    if(info) info.textContent = `Peli: ${game?.name || '–'} (${game?.status || '–'})`;

    // pisteet
    const scoresEl = document.getElementById('scores');
    if(scoresEl){
      scoresEl.innerHTML = '';
      if (teams.length) {
        teams.forEach(t=>{
          const row = document.createElement('div');
          row.className = 'score-row';
          row.innerHTML = `<span>${esc(t.name||'Joukkue')}</span><span>${t.score||0} p</span>`;
          scoresEl.appendChild(row);
        });
      } else {
        scoresEl.textContent = 'Ei joukkueita';
      }
    }

    // liput
    markers.clearLayers();
    const latlngs = [];
    flags.forEach(f=>{
      const lat = Number(f.lat), lon = Number(f.lon);
      if(Number.isFinite(lat) && Number.isFinite(lon) && (lat!==0 || lon!==0)){
        const fill = f.color || '#e5e7eb';
        L.circleMarker([lat, lon], {
          radius:8, weight:1, color:'#000', fillOpacity:0.9, fillColor: fill
        }).bindPopup(`<b>${esc(f.slug||'–')} ${esc(f.name||'Lippu')}</b><br>Pisteet: ${f.points}${f.ownerTeamId?`<br>Omistaja: ${f.ownerTeamId}`:''}`)
        .addTo(markers);
        latlngs.push([lat,lon]);
      }
    });
    if(latlngs.length && !areaLayer){
      map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
    }
  }

  (async function init(){
    try{
      await pickLatestGame();
      await loadArea();       // <-- piirrä pelialue, jos tallennettu
      await loadAndRender();
      setInterval(loadAndRender, 5000);
    }catch(e){
      showErr(e?.message || String(e));
      console.error(e);
    }
  })();
})();
