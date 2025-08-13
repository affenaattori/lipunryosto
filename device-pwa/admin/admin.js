(function(){
  const $ = id => document.getElementById(id);
  const state = {
    apiBase: localStorage.getItem('admin_apiBase') || '',
    teams: []
  };

  // Ota api=? query-parametri huomioon
  const params = new URLSearchParams(location.search);
  if (params.get('api')) state.apiBase = params.get('api');

  if ($('apiBase')) $('apiBase').value = state.apiBase;
  if ($('apiInfo')) $('apiInfo').textContent = state.apiBase ? `API: ${state.apiBase}` : 'API: –';
  if ($('saveApiBtn')) $('saveApiBtn').onclick = () => {
    state.apiBase = $('apiBase').value.trim();
    localStorage.setItem('admin_apiBase', state.apiBase);
    $('apiInfo').textContent = state.apiBase ? `API: ${state.apiBase}` : 'API: –';
    loadGames();
  };

  // Joukkue-editori
  function renderTeams(){
    const wrap = $('teamsWrap'); if(!wrap) return;
    wrap.innerHTML = '';
    if (state.teams.length === 0){
      state.teams.push({ name:'Sininen', color:'#2563eb' }, { name:'Punainen', color:'#ef4444' });
    }
    state.teams.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'team-row';
      row.innerHTML = `
        <input placeholder="Joukkueen nimi" value="${escapeHtml(t.name||'')}" data-k="name" style="flex:1">
        <input placeholder="Väri (esim. #FF0000)" value="${escapeHtml(t.color||'')}" data-k="color" style="width:180px">
        <button data-act="remove" type="button">Poista</button>`;
      row.querySelector('[data-k="name"]').oninput = (e)=>{ state.teams[i].name = e.target.value; };
      row.querySelector('[data-k="color"]').oninput = (e)=>{ state.teams[i].color = e.target.value; };
      row.querySelector('[data-act="remove"]').onclick = ()=>{ state.teams.splice(i,1); renderTeams(); };
      wrap.appendChild(row);
    });
  }
  if ($('addTeamBtn')) $('addTeamBtn').onclick = () => { state.teams.push({ name:'', color:'' }); renderTeams(); };
  renderTeams();

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function api(path){ return `${state.apiBase.replace(/\/$/,'')}${path}`; }
  function setCreateInfo(msg){ const el=$('createInfo'); if (el) el.textContent = msg || ''; }

  // Luo peli
  if ($('createGameBtn')) $('createGameBtn').onclick = async () => {
    if (!state.apiBase){ setCreateInfo('Aseta ensin API-osoite.'); return; }
    const name = $('gName').value.trim();
    const capture = parseInt($('gCapture').value||'60',10);
    const win = $('gWin').value;
    const timeEnabled = $('gTimeEnabled').value === 'true';
    const timeLimit = parseInt($('gTimeLimit').value||'0',10);
    const maxPointsInput = $('gMaxPoints').value;
    const arena = $('gArena').value.trim() || null;

    if (!name){ setCreateInfo('Anna pelin nimi.'); return; }
    const cleanTeams = state.teams
      .map(t => ({ name: t.name?.trim(), color: t.color?.trim() }))
      .filter(t => t.name);
    if (cleanTeams.length < 2){ setCreateInfo('Vähintään 2 nimettyä joukkuetta.'); return; }

    // Kokeile CamelCase → dto-kääre → PascalCase → dto-kääre
    const baseCamel = {
      name, captureTimeSeconds:capture, winCondition:win, arenaName:arena, teams: cleanTeams
    };
    if (timeEnabled) baseCamel.timeLimitMinutes = timeLimit;
    if (maxPointsInput !== '' && !Number.isNaN(parseInt(maxPointsInput,10))) baseCamel.maxPoints = parseInt(maxPointsInput,10);

    const basePascal = {
      Name:name, CaptureTimeSeconds:capture, CaptureMode:"TwoTapConfirm", WinCondition:win, ArenaName:arena,
      Teams: cleanTeams.map(t=>({Name:t.name, Color:t.color}))
    };
    if (timeEnabled) basePascal.TimeLimitMinutes = timeLimit;
    if (maxPointsInput !== '' && !Number.isNaN(parseInt(maxPointsInput,10))) basePascal.MaxPoints = parseInt(maxPointsInput,10);

    const clean = o => JSON.parse(JSON.stringify(o));
    async function tryPost(payload){
      const r = await fetch(api('/games'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(clean(payload)) });
      const text = await r.text(); return { ok:r.ok, status:r.status, text };
    }

    try{
      setCreateInfo('Luodaan peli…');
      let res = await tryPost(baseCamel);
      if (!res.ok && res.status === 400 && /"dto"| dto /i.test(res.text)) res = await tryPost({ dto: baseCamel });
      if (!res.ok && res.status === 400) {
        res = await tryPost(basePascal);
        if (!res.ok && res.status === 400 && /"dto"| dto /i.test(res.text)) res = await tryPost({ dto: basePascal });
      }
      if (!res.ok) throw new Error(res.text||'Virhe');

      setCreateInfo('Peli luotu ✓');
      $('gName').value='';
      loadGames();
    }catch(e){ setCreateInfo('Virhe pelin luonnissa: ' + (e?.message||e)); }
  };

  // Listaa pelit
  async function loadGames(){
    const tbody = $('gamesTbody'); const empty = $('gamesEmpty');
    if (!tbody || !state.apiBase) return;
    tbody.innerHTML = ''; if (empty) empty.style.display = 'block';
    try{
      const r = await fetch(api('/games'));
      if (!r.ok) throw new Error(await r.text());
      const list = await r.json();
      if (!Array.isArray(list) || list.length === 0){ if (empty) empty.style.display = 'block'; return; }
      if (empty) empty.style.display = 'none';

      list.forEach(g => {
        const gid = g.id || g.Id;
        const name = g.name || g.Name || '';
        const win = g.winCondition || g.WinCondition;
        const teams = g.teams || g.Teams || [];
        const timeTxt = g.timeLimitMinutes ? `${g.timeLimitMinutes} min` :
                        g.TimeLimitMinutes ? `${g.TimeLimitMinutes} min` : '—';
        const teamsTxt = teams.map(t=> (t.name||t.Name) ).join(', ');

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(name)}</td>
          <td class="small">${gid}</td>
          <td>${win==='AllFlagsOneTeam'?'Kaikki liput yhdellä':'Eniten pisteitä aikarajassa'}</td>
          <td>${timeTxt}</td>
          <td>${escapeHtml(teamsTxt)}</td>
          <td>
            <div class="row">
              <button data-act="flags">Lippujen hallinta</button>
              <button data-act="details">Pelin sivu</button>
              <button data-act="overview">Kartta-yleiskuva</button>
            </div>
          </td>
        `;

        tr.querySelector('[data-act="flags"]').onclick = () => {
          const url = `${location.origin}/admin-flags/flags.html?api=${encodeURIComponent(state.apiBase)}&gameId=${gid}`;
          window.open(url, '_blank');
        };
        tr.querySelector('[data-act="details"]').onclick = () => {
          const url = `${location.origin}/admin/game.html?api=${encodeURIComponent(state.apiBase)}&gameId=${gid}`;
          window.open(url, '_blank');
        };
        tr.querySelector('[data-act="overview"]').onclick = () => {
          const url = `${location.origin}/admin-flags/overview.html?api=${encodeURIComponent(state.apiBase)}&gameId=${gid}`;
          window.open(url, '_blank');
        };
        tbody.appendChild(tr);
      });
    }catch(e){
      console.error(e);
    }
  }

  if (state.apiBase) setTimeout(loadGames, 100);

})();
