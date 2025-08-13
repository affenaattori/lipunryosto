(function(){
  const qs = new URLSearchParams(location.search);
  const apiBase = (qs.get('api')||'').replace(/\/$/,'');
  let gameId = qs.get('gameId') || null;

  const info = document.getElementById('info');

  // Leaflet
  const map = L.map('map', { zoomControl:true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap -tekijät'
  }).addTo(map);
  const markers = L.layerGroup().addTo(map);

  if(!apiBase){
    info.textContent = 'Puuttuu ?api=...';
    throw new Error('API missing');
  }

  function api(path){ return apiBase + path; }

  async function fetchJson(url){
    const r = await fetch(url);
    const txt = await r.text();
    if(!r.ok) throw new Error(txt || ('HTTP '+r.status));
    if(!txt.trim()) return null;
    try { return JSON.parse(txt); } catch { return null; }
  }

  async function pickLatestGame(){
    if(gameId) return;
    const list = await fetchJson(api('/games'));
    if(Array.isArray(list) && list.length) gameId = list[0].id || list[0].Id;
  }

  function esc(s){ return (s??'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  async function loadAndRender(){
    if(!gameId) return;
    const game = await fetchJson(api(`/games/${gameId}`));
    const flags = await fetchJson(api(`/games/${gameId}/flags`)) || [];
    const teams = (game?.teams) || [];

    info.textContent = `Peli: ${game?.name || '–'} (${game?.status || '–'})`;

    // scoreboard
    const scoresEl = document.getElementById('scores');
    scoresEl.innerHTML = '';
    teams.forEach(t=>{
      const row = document.createElement('div');
      row.className = 'score-row';
      row.innerHTML = `<span>${esc(t.name||'Joukkue')}</span><span>${t.score||0} p</span>`;
      scoresEl.appendChild(row);
    });
    if(!teams.length) scoresEl.textContent = 'Ei joukkueita';

    // map markers
    markers.clearLayers();
    const latlngs = [];
    flags.forEach(f=>{
      const lat = Number(f.lat), lon = Number(f.lon);
      if(Number.isFinite(lat) && Number.isFinite(lon) && (lat!==0 || lon!==0)){
        const m = L.circleMarker([lat, lon], {
          radius:8, weight:1, color:'#000', fillOpacity:0.9, fillColor: f.color || '#e5e7eb'
        }).bindPopup(`<b>${esc(f.slug||'–')} ${esc(f.name||'Lippu')}</b><br>Pisteet: ${f.points}${f.ownerTeamId?`<br>Omistaja: ${f.ownerTeamId}`:''}`);
        m.addTo(markers);
        latlngs.push([lat,lon]);
      }
    });
    if(latlngs.length) map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
    else map.setView([60.1699,24.9384], 12);
  }

  (async function init(){
    await pickLatestGame();
    await loadAndRender();
    setInterval(loadAndRender, 5000);
  })();
})();
