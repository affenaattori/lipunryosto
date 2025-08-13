(function(){
  const $ = id => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const state = {
    apiBase: localStorage.getItem('admin_apiBase') || '',
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
    mapCfg: null,
    canvas: null, ctx: null,
    pan: {x:0,y:0,scale:1,drag:false, sx:0,sy:0, ox:0,oy:0},
    bg: {img:null, loaded:false, naturalW:0, naturalH:0}
  };

  // --- API base ---
  if (qs.get('api')) state.apiBase = qs.get('api');
  $('apiBase').value = state.apiBase;
  $('apiInfo').textContent = state.apiBase ? `API: ${state.apiBase}` : 'API: –';
  $('saveApi').onclick = ()=>{ state.apiBase = $('apiBase').value.trim(); localStorage.setItem('admin_apiBase', state.apiBase); $('apiInfo').textContent = `API: ${state.apiBase}`; };

  // --- Team palette helpers ---
  function teamRow(t,i){
    const row = document.createElement('div'); row.className = 'team-row';
    row.innerHTML = `
      <input placeholder="Joukkueen nimi" value="${esc(t.name||'')}" style="flex:1">
      <div class="palette" data-i="${i}"></div>
      <button type="button">Poista</button>`;
    const [nameInp, pal, delBtn] = row.querySelectorAll('input, .palette, button');
    nameInp.oninput = e => { state.teamsDraft[i].name = e.target.value; };
    delBtn.onclick = ()=>{ state.teamsDraft.splice(i,1); renderTeams(); };

    // render palette
    pal.innerHTML = '';
    state.palette.forEach(col=>{
      const sw = document.createElement('div'); sw.className = 'swatch';
      sw.style.background = col;
      if ((t.color||'').toLowerCase() === col.toLowerCase()) sw.classList.add('selected');
      sw.onclick = ()=>{
        state.teamsDraft[i].color = col;
        // refresh selection styles:
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
    const host = $('legendTeams'); host.innerHTML='';
    const teams = state.gameCache?.teams || state.teamsDraft;
    teams.forEach(t=>{
      const div = document.createElement('div');
      div.innerHTML = `<span class="dot" style="background:${esc(t.color||'#e5e7eb')}"></span>${esc(t.name||'Joukkue')}`;
      host.appendChild(div);
    });
  }
  $('addTeam').onclick = ()=>{ state.teamsDraft.push({name:'',color:''}); renderTeams(); };
  renderTeams();

  function api(path) {
  if (!state.apiBase) {
    throw new Error("API-osoitetta ei ole asetettu");
  }
  if (!path.startsWith("/")) path = "/" + path;
  return state.apiBase + path;
}
  
  // --- Create/select game ---
  $('createGame').onclick = async ()=>{
  if(!state.apiBase){ $('gMsg').textContent='Aseta API-osoite'; return; }
  const name = $('gName').value.trim();
  if(!name){ $('gMsg').textContent='Anna pelin nimi'; return; }
  const capture = parseInt($('gCapture').value||'60',10);
  const win = $('gWin').value;
  const timeLimit = parseInt($('gTimeLimit').value||'0',10);
  const teams = state.teamsDraft.filter(t=>t.name).map(t=>({ name:t.name, color:t.color }));

  if(teams.length < 2){ $('gMsg').textContent='Vähintään 2 joukkuetta'; return; }

  // kokeillaan useita muotoja (camel, {dto:{}}, Pascal), koska backend voi vaihdella
  const camel = { name, captureTimeSeconds:capture, winCondition:win, timeLimitMinutes: timeLimit>0?timeLimit:null, teams };
  const pascal = {
    Name:name, CaptureTimeSeconds:capture, WinCondition:win,
    TimeLimitMinutes: timeLimit>0?timeLimit:null,
    Teams: teams.map(t=>({ Name:t.name, Color:t.color }))
  };

  async function tryPost(payload){
    const r = await fetch(api('/games'), {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const text = await r.text();     // ÄLÄ tee r.json() suoraan
    return { ok:r.ok, status:r.status, text, location:r.headers.get('Location')||r.headers.get('location') };
  }

  $('gMsg').textContent = 'Luodaan peli…';

  try{
    let res = await tryPost(camel);
    if(!res.ok && res.status===400 && /dto/i.test(res.text||'')) res = await tryPost({ dto: camel });
    if(!res.ok && res.status===400){
      res = await tryPost(pascal);
      if(!res.ok && res.status===400) res = await tryPost({ dto: pascal });
    }
    if(!res.ok){
      throw new Error(res.text || `HTTP ${res.status}`);
    }

    // Yritä jäsentää JSON — jos tyhjä body, hae uusin peli listalta
    let game;
    if(res.text && res.text.trim().length>0){
      try { game = JSON.parse(res.text); } catch { /* jatketaan alla */ }
    }

    if(!game){
      // Jos Location-header → yritä hakea se
      if(res.location){
        try {
          const gr = await fetch(res.location);
          if(gr.ok) game = await gr.json();
        } catch {}
      }
    }

    if(!game){
      // fallback: hae /games ja ota uusin
      const lr = await fetch(api('/games'));
      const list = await lr.json();
      if(Array.isArray(list) && list.length) game = list[0];
    }

    if(!game) throw new Error('Pelin luonti onnistui, mutta vastausta ei saatu (tyhjä body).');

    state.selectedGameId = game.id || game.Id;
    $('gameInfo').textContent = `Peli: ${(game.name||game.Name)} (${game.status||game.Status})`;
    $('gMsg').textContent = 'Peli luotu ja valittu ✓';

    // nollaa kartta-asetukset tälle pelille + lataa data
    loadMapCfg();
    await (async ()=>{ const r = await fetch(api(`/games/${state.selectedGameId}`)); state.gameCache = await r.json(); })();
    await (async ()=>{ const r = await fetch(api(`/games/${state.selectedGameId}/flags`)); state.flags = await r.json(); })();
    draw();

    // tyhjennä lomake
    $('gName').value='';
  }catch(e){
    $('gMsg').textContent = 'Virhe: ' + (e?.message||e);
  }
};


  // --- Map config (local) ---
  function cfgKey(){ return `mapcfg_${state.selectedGameId||'none'}`; }
  function loadMapCfg(){
    const def = { url:'', nw:{lat:null,lon:null}, se:{lat:null,lon:null} };
    try{
      state.mapCfg = JSON.parse(localStorage.getItem(cfgKey())||'null') || def;
    }catch{ state.mapCfg = def; }
    $('mapUrl').value = state.mapCfg.url || '';
    $('nwLat').value = state.mapCfg.nw.lat ?? '';
    $('nwLon').value = state.mapCfg.nw.lon ?? '';
    $('seLat').value = state.mapCfg.se.lat ?? '';
    $('seLon').value = state.mapCfg.se.lon ?? '';
    loadBackground();
  }
  $('saveMapCfg').onclick = ()=>{
    state.mapCfg = {
      url: $('mapUrl').value.trim(),
      nw: { lat: numOrNull($('nwLat').value), lon: numOrNull($('nwLon').value) },
      se: { lat: numOrNull($('seLat').value), lon: numOrNull($('seLon').value) }
    };
    localStorage.setItem(cfgKey(), JSON.stringify(state.mapCfg));
    $('mapMsg').textContent = 'Tallennettu ✓';
    loadBackground();
    draw();
  };
  function numOrNull(v){ const n = parseFloat(v); return Number.isFinite(n) ? n : null; }

  // --- Background image ---
  function loadBackground(){
    state.bg = {img:null, loaded:false, naturalW:0, naturalH:0};
    const url = state.mapCfg?.url; if(!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>{ state.bg.img = img; state.bg.loaded = true; state.bg.naturalW = img.naturalWidth; state.bg.naturalH = img.naturalHeight; draw(); };
    img.onerror = ()=>{ $('mapMsg').textContent='Kuvan lataus epäonnistui'; };
    img.src = url;
  }

  // --- Fetch game/flags ---
  async function reloadGame(){
    if(!state.selectedGameId) return;
    const r = await fetch(api(`/games/${state.selectedGameId}`));
    state.gameCache = await r.json();
    renderLegendFromDraft();
  }
  async function reloadFlags(){
    if(!state.selectedGameId) return;
    const r = await fetch(api(`/games/${state.selectedGameId}/flags`));
    state.flags = await r.json();
    renderFlagList();
  }

  // --- Controls ---
  $('startGame').onclick = ()=> gameCtrl('start', 'Käynnissä ✓');
  $('pauseGame').onclick = ()=> gameCtrl('pause', 'Pausella ✓');
  $('endGame').onclick   = ()=> gameCtrl('end', 'Lopetettu ✓');

  async function gameCtrl(action, msg){
    if(!state.selectedGameId){ $('ctrlMsg').textContent='Ei valittua peliä'; return; }
    try{
      const r = await fetch(api(`/games/${state.selectedGameId}/${action}`), { method:'POST' });
      if(!r.ok) throw new Error(await r.text());
      $('ctrlMsg').textContent = msg;
      await reloadGame(); draw();
    }catch(e){ $('ctrlMsg').textContent = 'Virhe: '+(e?.message||e); }
  }

  $('normalize').onclick = async ()=>{
    if(!state.selectedGameId){ return; }
    try{
      const r = await fetch(api(`/games/${state.selectedGameId}/flags/normalize-slugs`), { method:'POST' });
      if(!r.ok) throw new Error(await r.text());
      await reloadFlags(); draw();
    }catch(e){ alert('Normalisointi epäonnistui:\n'+(e?.message||e)); }
  };
  $('refreshFlags').onclick = async ()=>{ await reloadFlags(); draw(); };

  function renderFlagList(){
    const host = $('flagsList'); host.innerHTML='';
    state.flags.forEach(f=>{
      const div = document.createElement('div'); div.className='row'; div.style.margin='6px 0';
      div.innerHTML = `
        <span class="chip">${esc(f.slug||'–')}</span>
        <span>${esc(f.name||'Lippu')}</span>
        <span class="chip">Pisteet: ${f.points}</span>
        ${f.color?`<span class="chip" style="background:${esc(f.color)};color:#000"> </span>`:''}
        <span class="small">(${fmtLatLon(f.lat)}, ${fmtLatLon(f.lon)})</span>`;
      host.appendChild(div);
    });
  }
  function fmtLatLon(v){ return (v===null||v===undefined) ? '-' : Number(v).toFixed(5); }

  // --- Canvas drawing ---
  state.canvas = $('mapCanvas');
  state.ctx = state.canvas.getContext('2d');

  function latLonToXY(lat, lon){
    const cfg = state.mapCfg;
    if(!cfg?.nw?.lat || !cfg?.nw?.lon || !cfg?.se?.lat || !cfg?.se?.lon || !state.bg.loaded){
      // ei kalibrointia → aseta keskelle pseudo-sijaintiin
      return { x: state.canvas.width/2, y: state.canvas.height/2 };
    }
    // lineaarinen projektiosta: NW -> (0,0), SE -> (W,H)
    const {nw,se} = cfg;
    const W = state.bg.naturalW, H = state.bg.naturalH;
    const x = ((lon - nw.lon)/(se.lon - nw.lon)) * W;
    const y = ((lat - nw.lat)/(se.lat - nw.lat)) * H; // huomaa: lat pienenee etelään → tämä voi olla käänteinen
    // käännetään y niin, että NW on y=0
    const yFlipped = H - y;
    // pan/zoom:
    const sx = x * state.pan.scale + state.pan.x;
    const sy = yFlipped * state.pan.scale + state.pan.y;
    return { x:sx, y:sy };
  }

  function draw(){
    const ctx = state.ctx, c = state.canvas;
    ctx.clearRect(0,0,c.width,c.height);
    // tausta
    if(state.bg.loaded){
      const w = state.bg.naturalW * state.pan.scale;
      const h = state.bg.naturalH * state.pan.scale;
      ctx.drawImage(state.bg.img, state.pan.x, state.pan.y, w, h);
    }else{
      // vararuudukko
      ctx.fillStyle = '#0b1220'; ctx.fillRect(0,0,c.width,c.height);
      ctx.strokeStyle = '#1f2937';
      for(let x=0;x<c.width;x+=50){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,c.height); ctx.stroke(); }
      for(let y=0;y<c.height;y+=50){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(c.width,y); ctx.stroke(); }
    }
    // liput
    state.flags.forEach(f=>{
      const p = latLonToXY(f.lat, f.lon);
      ctx.beginPath();
      ctx.fillStyle = f.color || '#e5e7eb';
      ctx.arc(p.x, p.y, 8, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#0008'; ctx.stroke();
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '12px system-ui';
      ctx.fillText(`${f.slug||'–'} ${f.name||''}`, p.x+12, p.y+4);
    });
  }

  // pan/zoom
  state.canvas.addEventListener('wheel', e=>{
    e.preventDefault();
    const delta = Math.sign(e.deltaY) * -0.1;
    state.pan.scale = Math.min(3, Math.max(0.4, state.pan.scale + delta));
    draw();
  }, { passive:false });

  state.canvas.addEventListener('mousedown', e=>{
    state.pan.drag = true;
    state.pan.sx = e.clientX; state.pan.sy = e.clientY;
    state.pan.ox = state.pan.x; state.pan.oy = state.pan.y;
  });
  window.addEventListener('mousemove', e=>{
    if(!state.pan.drag) return;
    const dx = e.clientX - state.pan.sx;
    const dy = e.clientY - state.pan.sy;
    state.pan.x = state.pan.ox + dx;
    state.pan.y = state.pan.oy + dy;
    draw();
  });
  window.addEventListener('mouseup', ()=> state.pan.drag=false);

  function esc(s){ return (s??'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  // init
  (async function init(){
    if(!state.apiBase){ return; }
    await pickLatestGame();
    renderTeams();
  })();

})();
