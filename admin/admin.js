// ================== State & helpers ==================
const state = {
  apiBase: null,
  games: [],
  gameId: null,
  gameStatus: "unknown",
  teams: [],
  preTeams: [],              // joukkueet ennen pelin luontia
  selectedColor: "#3B82F6",
  // Map/area
  map: null,
  markers: null,
  areaPolyline: null,
  areaPolygon: null,
  drawing: false,
  areaPoints: []             // [[lat,lon], ...]
};

const colors = [
  "#FF0000","#0000FF","#00FF00","#FFFF00","#FF00FF",
  "#00FFFF","#FFA500","#800000","#008000","#000080",
  "#808000","#800080","#008080","#A52A2A","#FF1493",
  "#7FFF00","#FFD700","#4B0082","#DC143C","#00CED1"
];

const $ = (id)=>document.getElementById(id);
const esc = (s)=> (s??'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&gt;','>':'&gt;','"':'&quot;' }[c]));

// toast
function ensureToast(){
  let t = document.getElementById('toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;right:16px;bottom:16px;background:#111827;border:1px solid #1f2937;color:#e5e7eb;padding:10px 12px;border-radius:10px;z-index:9999;display:none;max-width:60ch';
    document.body.appendChild(t);
  }
  return t;
}
function toast(msg, ok=true){
  const t = ensureToast();
  t.textContent = msg;
  t.style.display='block';
  t.style.borderColor = ok ? '#1f2937' : '#b91c1c';
  t.style.background = ok ? '#111827' : '#3f0d0d';
  setTimeout(()=>{ t.style.display='none'; }, 2200);
}

function api(path){ return state.apiBase.replace(/\/$/,'') + path; }

async function fetchJsonSafe(url, init){
  const r = await fetch(url, init);
  const txt = await r.text();
  if(!r.ok) throw new Error(txt || ('HTTP '+r.status));
  if(!txt || !txt.trim()) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

// ================== Palette & modal ==================
function buildPalette(){
  const host = $('palette'); if(!host) return;
  host.innerHTML='';
  colors.forEach(c=>{
    const el = document.createElement('div');
    el.className = 'chip' + (c===state.selectedColor?' sel':'');
    el.style.background = c;
    el.onclick = ()=>{
      state.selectedColor = c;
      document.querySelectorAll('.chip').forEach(x=>x.classList.remove('sel'));
      el.classList.add('sel');
    };
    host.appendChild(el);
  });
}

function openModal(){ $('modal').style.display='flex'; $('apiBase').value = state.apiBase || ''; }
function closeModal(){ $('modal').style.display='none'; }

// ================== Games ==================
async function loadGames(){
  const list = await fetchJsonSafe(api('/games')) || [];
  state.games = Array.isArray(list) ? list : [];
  renderGameSelect();
  if(!state.gameId && state.games.length){
    selectGame(state.games[0].id || state.games[0].Id);
  } else {
    renderTeams();
  }
}

function renderGameSelect(){
  const sel = $('gameSelect'); if(!sel) return;
  sel.innerHTML='';
  if(!state.games.length){ const o=document.createElement('option'); o.text='(ei pelejä)'; sel.appendChild(o); return; }
  state.games.forEach(g=>{
    const o = document.createElement('option');
    o.value = g.id || g.Id;
    o.text = `${g.name || g.Name} (${g.status || g.Status})`;
    sel.appendChild(o);
  });
  if(state.gameId) sel.value = state.gameId;
}

async function createGame(){
  const name = $('gName').value.trim();
  if(!name){ toast('Anna pelin nimi', false); return; }
  const captureTimeSeconds = Number($('gCapture').value)||60;
  const winCondition = $('gWin').value;
  const useTime = $('gUseTime').checked;
  const timeLimitMinutes = useTime ? Number($('gTime').value)||0 : null;
  const useMax = $('gUseMax').checked;
  const maxPoints = useMax ? Number($('gMax').value)||0 : null;

  if (state.preTeams.length < 2) {
    toast('Lisää vähintään 2 joukkuetta ennen pelin luontia', false);
    return;
  }

  const body = {
    name, captureTimeSeconds, winCondition,
    timeLimitMinutes, maxPoints,
    teams: state.preTeams.map(t=>({ name:t.name, color:t.color }))
  };

  const created = await fetchJsonSafe(api('/games'),{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });

  await loadGames();
  const id = (created && created.id) ? created.id : (state.games[0]?.id||state.games[0]?.Id);
  if(!id){ toast('Pelin luonti epäonnistui', false); return; }
  selectGame(id);

  $('gName').value = '';
  state.preTeams = [];
  renderTeams();
  toast('Peli luotu ✓');
}

function selectGame(id){
  state.gameId = id;
  const g = state.games.find(x=>(x.id||x.Id)===id);
  const name = g ? (g.name||g.Name) : '–';
  const status = g ? (g.status||g.Status||'–') : '–';
  state.gameStatus = status.toLowerCase();
  $('gameBadge').textContent = `Peli: ${name} (${status})`;
  const sel = $('gameSelect'); if(sel && sel.value !== id) sel.value = id;
  setControlButtonStates();
  reloadTeams();
  renderFieldLinks();
  // lataa aluekartta
  initMapOnce(); loadAreaFromApiOrLocal();
}

async function reloadGameBadge(){
  if(!state.gameId) return;
  const g = await fetchJsonSafe(api(`/games/${state.gameId}`));
  if(!g) return;
  state.gameStatus = (g.status||g.Status||'unknown').toLowerCase();
  $('gameBadge').textContent = `Peli: ${g.name || g.Name} (${g.status || g.Status})`;
  setControlButtonStates();
}

// ================== Teams ==================
async function reloadTeams(){
  if(!state.gameId) { renderTeams(); return; }
  const data = await fetchJsonSafe(api(`/games/${state.gameId}/teams`)) || [];
  state.teams = Array.isArray(data) ? data : [];
  renderTeams();
}

function renderTeams(){
  const host = $('teamList'); if(!host) return;
  host.innerHTML='';
  const isPreCreate = !state.gameId;

  const list = isPreCreate ? state.preTeams : state.teams;
  if(!list.length){
    host.innerHTML = `<div class="small">${isPreCreate ? 'Ei esiluontijoukkueita.' : 'Ei joukkueita.'}</div>`;
    return;
  }

  list.forEach((t, idx)=>{
    const row = document.createElement('div');
    row.className='team';

    const sw = document.createElement('div');
    sw.style.width='16px'; sw.style.height='16px'; sw.style.borderRadius='4px';
    sw.style.background=t.color || '#e5e7eb';
    row.appendChild(sw);

    const name = document.createElement('div');
    name.style.flex='1';
    name.textContent = `${t.name} (${t.color})`;
    row.appendChild(name);

    const del = document.createElement('button');
    del.className = 'btn-danger';
    del.textContent = 'Poista';
    del.style.padding = '6px 10px';

    if(isPreCreate){
      del.onclick = ()=>{
        state.preTeams.splice(idx,1);
        renderTeams();
      };
    }else{
      const teamId = t.id || t.Id;
      del.onclick = ()=> deleteTeam(teamId);
    }

    row.appendChild(del);
    host.appendChild(row);
  });
}

async function addTeam(){
  const name = $('teamName').value.trim();
  if(!name) return toast('Anna joukkueen nimi', false);
  const color = state.selectedColor;

  if(!state.gameId){
    state.preTeams.push({ name, color });
    $('teamName').value='';
    renderTeams();
    return;
  }

  await fetchJsonSafe(api(`/games/${state.gameId}/teams`),{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name, color })
  });
  $('teamName').value='';
  await reloadTeams();
}

async function deleteTeam(teamId){
  if(!state.gameId) return;
  if(!confirm('Poistetaanko tämä joukkue?')) return;
  await fetchJsonSafe(api(`/games/${state.gameId}/teams/${teamId}`), { method: 'DELETE' });
  await reloadTeams();
  toast('Joukkue poistettu ✓');
}

// ================== Game control ==================
function setControlButtonStates(){
  const st = state.gameStatus;
  const start = $('startGame'), pause=$('pauseGame'), end=$('endGame');
  if(!start||!pause||!end) return;
  // oletukset
  start.disabled = false; pause.disabled=false; end.disabled=false;

  if(st==='live'){
    start.disabled = true;
  }else if(st==='paused'){
    // kaikki ok
  }else if(st==='ended'){
    start.disabled = true; pause.disabled = true; end.disabled = true;
  }
}

async function startGame(){ if(!state.gameId) return;
  if(!confirm('Käynnistetäänkö peli?')) return;
  await fetchJsonSafe(api(`/games/${state.gameId}/start`),{method:'POST'});
  await reloadGameBadge();
  toast('Peli käynnistettiin ✓');
}
async function pauseGame(){ if(!state.gameId) return;
  await fetchJsonSafe(api(`/games/${state.gameId}/pause`),{method:'POST'});
  await reloadGameBadge();
  toast('Peli tauotettiin ✓');
}
async function endGame(){ if(!state.gameId) return;
  if(!confirm('Lopetetaanko peli?')) return;
  await fetchJsonSafe(api(`/games/${state.gameId}/end`),{method:'POST'});
  await reloadGameBadge();
  toast('Peli lopetettu ✓');
}

// ================== Field links (A–J) & Public link ==================
function renderFieldLinks(){
  const list = $('fieldLinks'); if(!list) return;
  list.innerHTML='';
  if(!state.apiBase) { list.innerHTML = '<div class="small">Aseta API (Asetukset → ⚙️).</div>'; return; }
  for(let i=0;i<10;i++){
    const L = String.fromCharCode(65+i);
    const url = `${location.origin}/device/?api=${encodeURIComponent(state.apiBase)}&flag=${L}`;
    const row = document.createElement('div');
    row.className='row'; row.style.alignItems='center';
    const a = document.createElement('a'); a.href=url; a.target='_blank'; a.textContent=`Lippu ${L} — Avaa`;
    const btn = document.createElement('button'); btn.className='btn-ghost'; btn.textContent='Kopioi';
    btn.onclick = async ()=>{ await navigator.clipboard.writeText(url); btn.textContent='Kopioitu ✓'; setTimeout(()=>btn.textContent='Kopioi',1000); };
    row.appendChild(a); row.appendChild(btn);
    list.appendChild(row);
  }
  // Public-linkki
  const publicRow = document.createElement('div');
  publicRow.className='row';
  const pubUrl = `${location.origin}/public/?api=${encodeURIComponent(state.apiBase)}`;
  const pubBtn = document.createElement('button'); pubBtn.className='btn-ghost'; pubBtn.textContent='Avaa Public';
  pubBtn.onclick = ()=> window.open(pubUrl,'_blank');
  publicRow.appendChild(pubBtn);
  list.appendChild(publicRow);
}

async function copyAllLinks(){
  if(!state.apiBase) return;
  let all='';
  for(let i=0;i<10;i++){
    const L = String.fromCharCode(65+i);
    const url = `${location.origin}/device/?api=${encodeURIComponent(state.apiBase)}&flag=${L}`;
    all += url + '\n';
  }
  await navigator.clipboard.writeText(all);
  toast('Kaikki linkit kopioitu ✓');
}

// ================== Leaflet map & area drawing ==================
function initMapOnce(){
  if(state.map || !$('adminMap')) return;
  // Leaflet script/stylesheet on publicissa — adminiin käytämme samaa CDN:ää:
  const css = document.createElement('link');
  css.rel='stylesheet'; css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(css);
  const js = document.createElement('script');
  js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  js.onload = ()=> {
    state.map = L.map('adminMap', { zoomControl:true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap -tekijät'
    }).addTo(state.map);
    state.markers = L.layerGroup().addTo(state.map);
    state.map.setView([60.1699, 24.9384], 12);

    // klikkaus lisää pisteen jos piirto päällä
    state.map.on('click', e=>{
      if(!state.drawing) return;
      state.areaPoints.push([e.latlng.lat, e.latlng.lng]);
      redrawArea();
    });

    // nappien kuuntelut
    const btnStart = $('btnStartDraw'), btnUndo=$('btnUndo'), btnClear=$('btnClear'), btnSave=$('btnSaveArea');
    if(btnStart) btnStart.onclick = toggleDraw;
    if(btnUndo) btnUndo.onclick = undoPoint;
    if(btnClear) btnClear.onclick = clearArea;
    if(btnSave) btnSave.onclick = saveArea;
  };
  document.body.appendChild(js);
}

function toggleDraw(){
  state.drawing = !state.drawing;
  $('btnStartDraw').textContent = state.drawing ? 'Lopeta piirto' : 'Piirrä alue';
  toast(state.drawing ? 'Piirtotila päällä: klikkaa karttaa lisätäksesi pisteitä' : 'Piirtotila pois');
}

function undoPoint(){
  if(!state.areaPoints.length) return;
  state.areaPoints.pop();
  redrawArea();
}

function clearArea(){
  state.areaPoints = [];
  redrawArea();
}

function redrawArea(){
  if(!state.map) return;
  if(state.areaPolyline){ state.map.removeLayer(state.areaPolyline); state.areaPolyline=null; }
  if(state.areaPolygon){ state.map.removeLayer(state.areaPolygon); state.areaPolygon=null; }

  if(state.areaPoints.length>=2){
    state.areaPolyline = L.polyline(state.areaPoints, { color:'#60a5fa', weight:3 }).addTo(state.map);
  }
  if(state.areaPoints.length>=3){
    state.areaPolygon = L.polygon(state.areaPoints, { color:'#60a5fa', weight:2, fillOpacity:0.1 }).addTo(state.map);
    const b = L.latLngBounds(state.areaPoints.map(p=>({lat:p[0],lng:p[1]})));
    state.map.fitBounds(b.pad(0.2));
  }
}

async function saveArea(){
  if(!state.gameId){ toast('Valitse peli ensin', false); return; }
  if(state.areaPoints.length<3){ toast('Piirrä vähintään 3 pistettä', false); return; }

  const geojson = {
    type: "Feature",
    properties: { kind: "game-area" },
    geometry: { type: "Polygon", coordinates: [ state.areaPoints.map(p=>[p[1], p[0]]) ] } // [lon,lat]
  };

  // tallenna localStorageen aina (fallback)
  localStorage.setItem(`area:${state.gameId}`, JSON.stringify(geojson));

  // yritä APIa (GET/PUT /games/{id}/area) – ei kaaduta, jos ei ole implementoitu
  try{
    await fetchJsonSafe(api(`/games/${state.gameId}/area`),{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(geojson)
    });
    toast('Alue tallennettu (API) ✓');
  }catch{
    toast('Alue tallennettu vain paikallisesti (API puuttuu) ✓');
  }
}

async function loadAreaFromApiOrLocal(){
  if(!state.gameId || !state.map) return;
  // 1) API
  try{
    const feat = await fetchJsonSafe(api(`/games/${state.gameId}/area`));
    if(feat && feat.geometry && feat.geometry.type==='Polygon'){
      state.areaPoints = (feat.geometry.coordinates?.[0]||[]).map(([lon,lat])=>[lat,lon]);
      redrawArea();
      return;
    }
  }catch{ /* ignore */ }
  // 2) Local
  try{
    const raw = localStorage.getItem(`area:${state.gameId}`);
    if(raw){
      const feat = JSON.parse(raw);
      if(feat && feat.geometry && feat.geometry.type==='Polygon'){
        state.areaPoints = (feat.geometry.coordinates?.[0]||[]).map(([lon,lat])=>[lat,lon]);
        redrawArea();
        return;
      }
    }
  }catch{ /* ignore */ }
  // default: tyhjä
  state.areaPoints = [];
  redrawArea();
}

// ================== Init & wiring ==================
function deriveApi(){
  const qs = new URLSearchParams(location.search);
  const fromQs = (qs.get('api')||'').trim();
  const fromStore = localStorage.getItem('admin_apiBase')||'';
  state.apiBase = (fromQs || fromStore).replace(/\/$/,'');
  if(fromQs) localStorage.setItem('admin_apiBase', state.apiBase);
}

function wire(){
  $('openSettings')?.addEventListener('click', openModal);
  $('closeSettings')?.addEventListener('click', closeModal);
  $('saveApi')?.addEventListener('click', ()=>{
    const v = $('apiBase').value.trim().replace(/\/$/,'');
    if(!v){ toast('Anna API-osoite', false); return; }
    state.apiBase = v;
    localStorage.setItem('admin_apiBase', v);
    closeModal();
    bootAfterApi();
  });

  $('createGame')?.addEventListener('click', ()=>safeCall(createGame));
  $('refreshGames')?.addEventListener('click', ()=>safeCall(loadGames));
  $('gameSelect')?.addEventListener('change', (e)=> selectGame(e.target.value));

  $('addTeam')?.addEventListener('click', ()=>safeCall(addTeam));

  $('startGame')?.addEventListener('click', ()=>safeCall(startGame));
  $('pauseGame')?.addEventListener('click', ()=>safeCall(pauseGame));
  $('endGame')?.addEventListener('click', ()=>safeCall(endGame));

  $('copyAllLinks')?.addEventListener('click', ()=>safeCall(copyAllLinks));

  // Auto-refresh kun peli live/paused: päivitys 10 s välein
  setInterval(async ()=>{
    if(!state.apiBase || !state.gameId) return;
    if(state.gameStatus==='ended') return;
    try{
      await reloadGameBadge();
      await reloadTeams();
    }catch{}
  }, 10000);
}

async function safeCall(fn){
  try{ await fn(); }
  catch(e){ console.error(e); toast('Virhe: '+(e?.message||e), false); }
}

async function bootAfterApi(){
  if(!state.apiBase){ openModal(); return; }
  $('apiBase').value = state.apiBase;
  buildPalette();
  await loadGames();
  renderFieldLinks();
  initMapOnce();
}

document.addEventListener('DOMContentLoaded', async ()=>{
  deriveApi();
  wire();
  if(!state.apiBase){ openModal(); } else { await bootAfterApi(); }
});
