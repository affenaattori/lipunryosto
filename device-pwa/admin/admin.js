(function(){
  const $ = id => document.getElementById(id);
  const qs = new URLSearchParams(location.search);

  // ------------------ State ------------------
  const state = {
    apiBase: localStorage.getItem('admin_apiBase') || (qs.get('api')||''),
    palette: [
      '#EF4444','#F97316','#F59E0B','#EAB308','#84CC16',
      '#22C55E','#10B981','#14B8A6','#06B6D4','#0EA5E9',
      '#3B82F6','#6366F1','#8B5CF6','#A855F7','#D946EF',
      '#EC4899','#F43F5E','#737373','#A3A3A3','#F5F5F5'
    ],
    teamsDraft: [],
    selectedGameId: null,
    gameCache: null,
    flags: [],
    // Leaflet
    map: null,
    markersLayer: null,
    areaLayer: null,
    drawControl: null,
    drawnPolygon: null
  };

  // ------------------ Helpers ------------------
async function fetchJsonSafe(url, init){
  const r = await fetch(url, init);
  const text = await r.text();
  if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
  if (!text || !text.trim()) return null;   // tyhjä runko OK
  try { return JSON.parse(text); } catch { return null; }
} 
  function esc(s){ return (s??'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
  function api(path){
    if (!state.apiBase) throw new Error('API-osoitetta ei ole asetettu');
    if (!path.startsWith('/')) path = '/' + path;
    return state.apiBase.replace(/\/$/,'') + path;
  }

  // ------------------ Header / API base ------------------
  $('apiBase').value = state.apiBase;
  $('apiInfo').textContent = state.apiBase ? `API: ${state.apiBase}` : 'API: –';
  $('saveApi').onclick = ()=>{
    state.apiBase = $('apiBase').value.trim();
    localStorage.setItem('admin_apiBase', state.apiBase);
    $('apiInfo').textContent = state.apiBase ? `API: ${state.apiBase}` : 'API: –';
  };

  // ------------------ Team palette ------------------
  function teamRow(t,i){
    const row = document.createElement('div'); row.className = 'team-row';
    row.innerHTML = `
      <input placeholder="Joukkueen nimi" value="${esc(t.name||'')}" style="flex:1">
      <div class="palette" data-i="${i}"></div>
      <button type="button">Poista</button>`;
    const [nameInp, pal, delBtn] = row.querySelectorAll('input, .palette, button');
    nameInp.oninput = e => { state.teamsDraft[i].name = e.target.value; };
    delBtn.onclick = ()=>{ state.teamsDraft.splice(i,1); renderTeams(); };

    pal.innerHTML = '';
    state.palette.forEach(col=>{
      const sw = document.createElement('div'); sw.className='swatch'; sw.style.background=col;
      if ((t.color||'').toLowerCase()===col.toLowerCase()) sw.classList.add('selected');
      sw.onclick = ()=>{
        state.teamsDraft[i].color = col;
        [...pal.children].forEach(ch=>ch.classList.remove('selected'));
        sw.classList.add('selected');
        renderLegendFromDraft();
      };
      pal.appendChild(sw);
    });
    return row;
  }
  function renderTeams(){
    const host = $('teamsWrap'); host.innerHTML='';
    if (!state.teamsDraft.length){
      state.teamsDraft = [
        { name:'Sininen', color:'#3B82F6' },
        { name:'Punainen', color:'#EF4444' }
      ];
    }
    state.teamsDraft.forEach((t,i)=> host.appendChild(teamRow(t,i)));
    renderLegendFromDraft();
  }
  function renderLegendFromDraft(){
    const host = $('legendTeams'); if(!host) return;
    host.innerHTML='';
    const teams = state.gameCache?.teams || state.teamsDraft;
    teams.forEach(t=>{
      const div = document.createElement('div');
      div.innerHTML = `<span class="dot" style="background:${esc(t.color||'#e5e7eb')}"></span>${esc(t.name||'Joukkue')}`;
      host.appendChild(div);
    });
  }
  $('addTeam').onclick = ()=>{ state.teamsDraft.push({name:'',color:''}); renderTeams(); };
  renderTeams();

  // ------------------ Leaflet init ------------------
  function initLeaflet(){
    if (state.map) return;
    state.map = L.map('leafletMap', { zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap -tekijät'
    }).addTo(state.map);

    state.markersLayer = L.layerGroup().addTo(state.map);
    state.areaLayer = L.featureGroup().addTo(state.map);
    state.map.setView([60.1699, 24.9384], 12);

    state.drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        marker: false, circle: false, rectangle: false, polyline: false, circlemarker: false,
        polygon: { showArea: true, allowIntersection: false }
      },
      edit: { featureGroup: state.areaLayer, edit: true, remove: true }
    });
  }

  function wireDrawEvents(){
    // created
    state.map.on('draw:created', (e)=>{
      if (e.layerType === 'polygon') {
        state.areaLayer.clearLayers();
        state.drawnPolygon = e.layer;
        state.areaLayer.addLayer(state.drawnPolygon);
        $('areaMsg').textContent = 'Alue piirretty (tallenna alue).';
        fitAndLockToArea();
      }
    });
    // edited
    state.map.on('draw:edited', ()=>{
      $('areaMsg').textContent = 'Aluetta muokattu (tallenna alue).';
      state.drawnPolygon = null;
      state.areaLayer.eachLayer(l=>{ state.drawnPolygon = l; });
      fitAndLockToArea();
    });
    // deleted
    state.map.on('draw:deleted', ()=>{
      state.areaLayer.clearLayers();
      state.drawnPolygon = null;
      $('areaMsg').textContent = 'Alue poistettu (muista tallentaa).';
      state.map.setMaxBounds(null);
    });
  }

  // Draw toolbar toggle
  $('enableDraw').onclick = ()=>{
    if (!state.map) return;
    const onMap = Object.values(state.map._controls || {}).includes(state.drawControl);
    if (!onMap) {
      state.map.addControl(state.drawControl);
      $('areaMsg').textContent = 'Piirtotila päällä: valitse Polygon-työkalu vasemmalta.';
    } else {
      state.map.removeControl(state.drawControl);
      $('areaMsg').textContent = 'Piirtotila pois.';
    }
  };

  // Save / clear area
  $('saveArea').onclick = ()=>{
    if (!state.selectedGameId){ $('areaMsg').textContent='Valitse peli ensin'; return; }
    let geo = null;
    if (state.drawnPolygon) geo = state.drawnPolygon.toGeoJSON();
    localStorage.setItem(areaKey(), JSON.stringify(geo));
    $('areaMsg').textContent = geo ? 'Alue tallennettu ✓' : 'Tyhjennys tallennettu ✓';
  };
  $('clearArea').onclick = ()=>{
    state.areaLayer.clearLayers();
    state.drawnPolygon = null;
    localStorage.removeItem(areaKey());
    state.map.setMaxBounds(null);
    $('areaMsg').textContent = 'Alue tyhjennetty.';
  };
  function areaKey(){ return `area_${state.selectedGameId||'none'}`; }

  function loadAreaFromStorage(){
    state.areaLayer.clearLayers();
    state.drawnPolygon = null;
    const raw = localStorage.getItem(areaKey());
    if (!raw){ fitDefault(); return; }
    try{
      const gj = JSON.parse(raw);
      if (gj) {
        const layer = L.geoJSON(gj);
        layer.eachLayer(l=>{
          state.drawnPolygon = l;
          state.areaLayer.addLayer(l);
        });
        fitAndLockToArea();
        $('areaMsg').textContent = 'Alue ladattu.';
        return;
      }
    }catch{}
    fitDefault();
  }
  function fitAndLockToArea(){
    if (!state.drawnPolygon) return;
    const b = state.drawnPolygon.getBounds();
    state.map.fitBounds(b.pad(0.05));
    state.map.setMaxBounds(b.pad(0.10));
  }
  function fitDefault(){
    const pts = state.flags
      .map(f=>[Number(f.lat), Number(f.lon)])
      .filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&(a!==0||b!==0));
    if (pts.length){
      const b = L.latLngBounds(pts);
      state.map.fitBounds(b.pad(0.2));
    } else {
      state.map.setView([60.1699, 24.9384], 12);
    }
    state.map.setMaxBounds(null);
  }

  // ------------------ Create & select game (robust JSON handling) ------------------
  $('createGame').onclick = async ()=>{
    if(!state.apiBase){ $('gMsg').textContent='Aseta API-osoite'; return; }
    const name = $('gName').value.trim();
    if(!name){ $('gMsg').textContent='Anna pelin nimi'; return; }
    const capture = parseInt($('gCapture').value||'60',10);
    const win = $('gWin').value;
    const timeLimit = parseInt($('gTimeLimit').value||'0',10);
    const teams = state.teamsDraft.filter(t=>t.name).map(t=>({ name:t.name, color:t.color }));
    if(teams.length<2){ $('gMsg').textContent='Vähintään 2 joukkuetta'; return; }

    const camel = { name, captureTimeSeconds:capture, winCondition:win, timeLimitMinutes: timeLimit>0?timeLimit:null, teams };
    const pascal = {
      Name:name, CaptureTimeSeconds:capture, WinCondition:win,
      TimeLimitMinutes: timeLimit>0?timeLimit:null,
      Teams: teams.map(t=>({ Name:t.name, Color:t.color }))
    };
    async function tryPost(payload){
      const r = await fetch(api('/games'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const text = await r.text();
      return { ok:r.ok, status:r.status, text, location:r.headers.get('Location')||r.headers.get('location') };
    }

    $('gMsg').textContent='Luodaan peli…';
    try{
      let res = await tryPost(camel);
      if(!res.ok && res.status===400 && /dto/i.test(res.text||'')) res = await tryPost({ dto: camel });
      if(!res.ok && res.status===400){
        res = await tryPost(pascal);
        if(!res.ok && res.status===400) res = await tryPost({ dto: pascal });
      }
      if(!res.ok) throw new Error(res.text || `HTTP ${res.status}`);

      let game;
      if(res.text && res.text.trim().length>0){ try{ game = JSON.parse(res.text); }catch{} }
      if(!game && res.location){
        try{ const gr = await fetchJsonSafe(res.location); if(gr.ok) game = await gr.json(); }catch{}
      }
      if(!game){
        const lr = await fetchJsonSafe(api('/games'));
        const list = await lr.json();
        if(Array.isArray(list) && list.length) game = list[0];
      }
      if(!game) throw new Error('Pelin luonti onnistui, mutta vastausta ei saatu (tyhjä body).');

      state.selectedGameId = game.id || game.Id;
      $('gameInfo').textContent = `Peli: ${(game.name||game.Name)} (${game.status||game.Status})`;
      $('gMsg').textContent = 'Peli luotu ja valittu ✓';

      // Lataa ja piirrä
      loadAreaFromStorage();
      await reloadGame();
      await reloadFlags();
      $('gName').value='';
    }catch(e){ $('gMsg').textContent='Virhe: '+(e?.message||e); }
  };

  // ------------------ Load latest game on init ------------------
  async function pickLatestGame(){
  if(!state.apiBase) return;
  try{
    const list = await fetchJsonSafe(api('/games'));
    if(Array.isArray(list) && list.length){
      state.selectedGameId = list[0].id || list[0].Id;
      $('gameInfo').textContent = `Peli: ${list[0].name || list[0].Name} (${list[0].status || list[0].Status})`;
      await reloadGame();
      loadAreaFromStorage();
      await reloadFlags();
    }
  }catch(e){
    console.warn('pickLatestGame failed:', e);
  }
}

  // ------------------ Fetch game & flags ------------------
async function reloadGame(){
  if(!state.selectedGameId) return;
  const data = await fetchJsonSafe(api(`/games/${state.selectedGameId}`));
  state.gameCache = data || null;         // sallitaan null, jos body tyhjä
  renderLegendFromDraft();
}

  async function reloadFlags(){
  if(!state.selectedGameId) return;
  const data = await fetchJsonSafe(api(`/games/${state.selectedGameId}/flags`));
  state.flags = Array.isArray(data) ? data : [];
  renderFlagList();
  renderFlagsOnMap();
  if(!state.drawnPolygon) fitDefault();
}


  // ------------------ Game controls ------------------
  $('startGame').onclick = ()=> gameCtrl('start','Käynnissä ✓');
  $('pauseGame').onclick = ()=> gameCtrl('pause','Pausella ✓');
  $('endGame').onclick   = ()=> gameCtrl('end','Lopetettu ✓');
  async function gameCtrl(action,msg){
    if(!state.selectedGameId){ $('ctrlMsg').textContent='Ei valittua peliä'; return; }
    try{
      const r = await fetch(api(`/games/${state.selectedGameId}/${action}`), { method:'POST' });
      if(!r.ok) throw new Error(await r.text());
      $('ctrlMsg').textContent = msg;
      await reloadGame();
    }catch(e){ $('ctrlMsg').textContent = 'Virhe: '+(e?.message||e); }
  }

  // ------------------ Flags (read-only from backend) ------------------
  $('normalize').onclick = async ()=>{
    if(!state.selectedGameId) return;
    try{
      const r = await fetch(api(`/games/${state.selectedGameId}/flags/normalize-slugs`), { method:'POST' });
      if(!r.ok) throw new Error(await r.text());
      await reloadFlags();
    }catch(e){ alert('Normalisointi epäonnistui:\n'+(e?.message||e)); }
  };
  $('refreshFlags').onclick = async ()=>{ await reloadFlags(); };

  function renderFlagList(){
    const host = $('flagsList'); host.innerHTML='';
    state.flags.forEach(f=>{
      const div = document.createElement('div'); div.className='row'; div.style.margin='6px 0';
      div.innerHTML = `
        <span class="chip">${esc(f.slug||'–')}</span>
        <span>${esc(f.name||'Lippu')}</span>
        <span class="chip">Pisteet: ${f.points}</span>
        ${f.color?`<span class="chip" style="background:${esc(f.color)};color:#000"> </span>`:''}
        <span class="small">(${fmt(f.lat)}, ${fmt(f.lon)})</span>`;
      host.appendChild(div);
    });
  }
  function fmt(v){ return (v===null||v===undefined) ? '-' : Number(v).toFixed(5); }

  function renderFlagsOnMap(){
    if(!state.map || !state.markersLayer) return;
    state.markersLayer.clearLayers();
    state.flags.forEach(f=>{
      const lat = Number(f.lat), lon = Number(f.lon);
      if(Number.isFinite(lat) && Number.isFinite(lon) && (lat!==0 || lon!==0)){
        L.circleMarker([lat, lon], {
          radius: 8, weight: 1, color: '#000', fillOpacity: 0.9,
          fillColor: f.color || '#e5e7eb'
        })
        .bindPopup(`<b>${esc(f.slug||'–')} ${esc(f.name||'Lippu')}</b><br>Pisteet: ${f.points}${f.ownerTeamId?`<br>Omistaja: ${f.ownerTeamId}`:''}`)
        .addTo(state.markersLayer);
      }
    });
  }

  // ------------------ Init ------------------
  (async function init(){
    initLeaflet();
    wireDrawEvents();
    if(!state.apiBase) return;
    await pickLatestGame();
  })();

})();
