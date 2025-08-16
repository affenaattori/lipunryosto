// ======== Perus tila ========
const state = {
  apiBase: null,
  games: [],
  gameId: null,
  teams: [],
  selectedColor: "#3B82F6"
};

const colors = [
  "#FF0000","#0000FF","#00FF00","#FFFF00","#FF00FF",
  "#00FFFF","#FFA500","#800000","#008000","#000080",
  "#808000","#800080","#008080","#A52A2A","#FF1493",
  "#7FFF00","#FFD700","#4B0082","#DC143C","#00CED1"
];

const $ = (id)=>document.getElementById(id);
function api(path){ return state.apiBase.replace(/\/$/,'') + path; }
function esc(s){ return (s??'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

async function fetchJsonSafe(url, init){
  const r = await fetch(url, init);
  const txt = await r.text();
  if(!r.ok) throw new Error(txt || ('HTTP '+r.status));
  if(!txt || !txt.trim()) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

// ======== UI: palette, modal, notif ========
function buildPalette(){
  const host = $('palette'); host.innerHTML='';
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

// ======== Games ========
async function loadGames(){
  const list = await fetchJsonSafe(api('/games')) || [];
  state.games = Array.isArray(list) ? list : [];
  renderGameSelect();
  if(!state.gameId && state.games.length){
    selectGame(state.games[0].id || state.games[0].Id);
  }
}

function renderGameSelect(){
  const sel = $('gameSelect'); sel.innerHTML='';
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
  if(!name){ alert('Anna pelin nimi'); return; }
  const captureTimeSeconds = Number($('gCapture').value)||60;
  const winCondition = $('gWin').value;
  const useTime = $('gUseTime').checked;
  const timeLimitMinutes = useTime ? Number($('gTime').value)||0 : null;
  const useMax = $('gUseMax').checked;
  const maxPoints = useMax ? Number($('gMax').value)||0 : null;

  const body = {
    name, captureTimeSeconds, winCondition,
    timeLimitMinutes, maxPoints,
    teams: [] // luodaan tiimit erikseen
  };

  const res = await fetchJsonSafe(api('/games'),{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });

  // fallback: jos API palauttaa location mutta ei bodya
  let created = res;
  if(!created || !created.id){
    const list = await fetchJsonSafe(api('/games')) || [];
    created = Array.isArray(list) && list.length ? list[0] : null;
  }
  if(!created){ alert('Pelin luonti epäonnistui'); return; }

  await loadGames();
  selectGame(created.id || created.Id);
  $('gName').value = '';
}

function selectGame(id){
  state.gameId = id;
  const g = state.games.find(x=>(x.id||x.Id)===id);
  $('gameBadge').textContent = g ? `Peli: ${g.name || g.Name} (${g.status || g.Status})` : 'Peli: –';
  if($('gameSelect').value !== id) $('gameSelect').value = id;
  reloadTeams();
  renderFieldLinks();
}

async function reloadGameBadge(){
  if(!state.gameId) return;
  const g = await fetchJsonSafe(api(`/games/${state.gameId}`));
  $('gameBadge').textContent = g ? `Peli: ${g.name || g.Name} (${g.status || g.Status})` : 'Peli: –';
}

// ======== Teams ========
async function reloadTeams(){
  if(!state.gameId) { $('teamList').innerHTML=''; return; }
  const data = await fetchJsonSafe(api(`/games/${state.gameId}/teams`)) || [];
  state.teams = Array.isArray(data) ? data : [];
  renderTeams();
}

function renderTeams(){
  const host = $('teamList'); host.innerHTML='';
  if(!state.teams.length){ host.innerHTML='<div class="small">Ei joukkueita.</div>'; return; }
  state.teams.forEach(t=>{
    const row = document.createElement('div');
    row.className='team';
    const sw = document.createElement('div');
    sw.style.width='16px'; sw.style.height='16px'; sw.style.borderRadius='4px'; sw.style.background=t.color || '#e5e7eb';
    row.appendChild(sw);
    const name = document.createElement('div');
    name.textContent = `${t.name} (${t.color})`;
    row.appendChild(name);
    host.appendChild(row);
  });
}

async function addTeam(){
  if(!state.gameId) return alert('Valitse peli ensin');
  const name = $('teamName').value.trim();
  if(!name) return alert('Anna joukkueen nimi');
  const color = state.selectedColor;
  await fetchJsonSafe(api(`/games/${state.gameId}/teams`),{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name, color })
  });
  $('teamName').value='';
  await reloadTeams();
}

// ======== Game control ========
async function startGame(){ if(!state.gameId) return;
  await fetchJsonSafe(api(`/games/${state.gameId}/start`),{method:'POST'});
  await reloadGameBadge();
}
async function pauseGame(){ if(!state.gameId) return;
  await fetchJsonSafe(api(`/games/${state.gameId}/pause`),{method:'POST'});
  await reloadGameBadge();
}
async function endGame(){ if(!state.gameId) return;
  if(!confirm('Lopetetaanko peli?')) return;
  await fetchJsonSafe(api(`/games/${state.gameId}/end`),{method:'POST'});
  await reloadGameBadge();
}

// ======== Field links (A–J) ========
function renderFieldLinks(){
  const list = $('fieldLinks'); list.innerHTML='';
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
}

async function copyAllLinks(){
  if(!state.apiBase || !state.gameId) return;
  let all='';
  for(let i=0;i<10;i++){
    const L = String.fromCharCode(65+i);
    const url = `${location.origin}/device/?api=${encodeURIComponent(state.apiBase)}&flag=${L}`;
    all += url + '\n';
  }
  await navigator.clipboard.writeText(all);
  alert('Kaikki linkit kopioitu');
}

// ======== Init ========
function deriveApi(){
  const qs = new URLSearchParams(location.search);
  const fromQs = (qs.get('api')||'').trim();
  const fromStore = localStorage.getItem('admin_apiBase')||'';
  state.apiBase = (fromQs || fromStore).replace(/\/$/,'');
  if(fromQs) localStorage.setItem('admin_apiBase', state.apiBase);
}

function wire(){
  $('openSettings').onclick = openModal;
  $('closeSettings').onclick = closeModal;
  $('saveApi').onclick = ()=>{
    const v = $('apiBase').value.trim().replace(/\/$/,'');
    if(!v){ alert('Anna API-osoite'); return; }
    state.apiBase = v;
    localStorage.setItem('admin_apiBase', v);
    closeModal();
    bootAfterApi();
  };

  $('createGame').onclick = ()=>safeCall(createGame);
  $('refreshGames').onclick = ()=>safeCall(loadGames);
  $('gameSelect').onchange = (e)=> selectGame(e.target.value);

  $('addTeam').onclick = ()=>safeCall(addTeam);

  $('startGame').onclick = ()=>safeCall(startGame);
  $('pauseGame').onclick = ()=>safeCall(pauseGame);
  $('endGame').onclick = ()=>safeCall(endGame);

  $('copyAllLinks').onclick = ()=>safeCall(copyAllLinks);
}

async function safeCall(fn){
  try{ await fn(); }catch(e){ console.error(e); alert('Virhe: '+(e?.message||e)); }
}

async function bootAfterApi(){
  if(!state.apiBase){ openModal(); return; }
  $('apiBase').value = state.apiBase;   // asetukset-modalissa näkyy nykyinen
  await loadGames();
  renderFieldLinks();
}

document.addEventListener('DOMContentLoaded', async ()=>{
  buildPalette();
  deriveApi();
  wire();
  if(!state.apiBase){ openModal(); } else { await bootAfterApi(); }
});
