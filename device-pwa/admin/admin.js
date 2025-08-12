(function(){
  const $ = id => document.getElementById(id);
  const state = {
    apiBase: localStorage.getItem('admin_apiBase') || '',
    teams: []
  };

  // URL param api override
  const params = new URLSearchParams(location.search);
  if (params.get('api')) state.apiBase = params.get('api');
  $('apiBase').value = state.apiBase;
  $('apiInfo').textContent = state.apiBase || 'API: –';

  $('saveApiBtn').onclick = () => {
    state.apiBase = $('apiBase').value.trim();
    localStorage.setItem('admin_apiBase', state.apiBase);
    $('apiInfo').textContent = state.apiBase || 'API: –';
  };

  // Team builder
  function renderTeams(){
    const wrap = $('teamsWrap');
    wrap.innerHTML = '';
    if (state.teams.length === 0){
      state.teams.push({ name:'Sininen', color:'#2563eb' }, { name:'Punainen', color:'#ef4444' });
    }
    state.teams.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'team-row';
      row.innerHTML = `
        <input placeholder="Joukkueen nimi" value="${escapeHtml(t.name||'')}" data-k="name">
        <input placeholder="Väri (esim. #FF0000)" value="${escapeHtml(t.color||'')}" data-k="color">
        <button data-act="remove">Poista</button>
      `;
      row.querySelector('[data-k="name"]').oninput = (e)=>{ state.teams[i].name = e.target.value; };
      row.querySelector('[data-k="color"]').oninput = (e)=>{ state.teams[i].color = e.target.value; };
      row.querySelector('[data-act="remove"]').onclick = ()=>{ state.teams.splice(i,1); renderTeams(); };
      wrap.appendChild(row);
    });
  }
  $('addTeamBtn').onclick = () => { state.teams.push({ name:'', color:'' }); renderTeams(); };
  renderTeams();

  // Helpers
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function api(path){ return `${state.apiBase.replace(/\/$/,'')}${path}`; }
  function setCreateInfo(msg){ $('createInfo').textContent = msg || ''; }

  // Create game
  $('createGameBtn').onclick = async () => {
    if (!state.apiBase){ setCreateInfo('Aseta ensin API-osoite.'); return; }
    const name = $('gName').value.trim();
    const capture = parseInt($('gCapture').value||'60',10);
    const win = $('gWin').value;
    const timeEnabled = $('gTimeEnabled').value === 'true';
    const timeLimit = parseInt($('gTimeLimit').value||'0',10);
    const maxPoints = $('gMaxPoints').value ? parseInt($('gMaxPoints').value,10) : null;
    const arena = $('gArena').value.trim() || null;

    if (!name){ setCreateInfo('Anna pelin nimi.'); return; }
    if (state.teams.length < 2){ setCreateInfo('Lisää vähintään 2 joukkuetta.'); return; }

    const cleanTeams = state.teams
      .map(t => ({ name: t.name?.trim(), color: t.color?.trim() }))
      .filter(t => t.name);

    if (cleanTeams.length < 2){ setCreateInfo('Vähintään 2 nimettyä joukkuetta vaaditaan.'); return; }

    const body = {
      name,
      captureTimeSeconds: isFinite(capture) ? capture : 60,
      winCondition: win,                 // "MostPointsAtTime" | "AllFlagsOneTeam"
      timeLimitMinutes: timeEnabled ? (isFinite(timeLimit)? timeLimit : 30) : null,
      maxPoints: maxPoints,
      arenaName: arena,
      teams: cleanTeams                  // [{name,color},...]
    };

    try{
      setCreateInfo('Luodaan peli…');
      const r = await fetch(api('/games'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      const g = await r.json();
      setCreateInfo('Peli luotu ✓');
      await loadGames();
      // clear name but keep teams for convenience
      $('gName').value='';
    }catch(e){
      setCreateInfo('Virhe pelin luonnissa: ' + (e?.message||e));
    }
  };

  // List games
  async function loadGames(){
    if (!state.apiBase) return;
    const tbody = $('gamesTbody'); const empty = $('gamesEmpty');
    tbody.innerHTML = ''; empty.style.display = 'block';
    try{
      const r = await fetch(api('/games'));
      if (!r.ok) throw new Error(await r.text());
      const list = await r.json();
      if (!Array.isArray(list) || list.length === 0){ empty.style.display = 'block'; return; }
      empty.style.display = 'none';
      list.forEach(g => {
        const tr = document.createElement('tr');
        const timeTxt = g.timeLimitMinutes ? `${g.timeLimitMinutes} min` : '—';
        const teamsTxt = (g.teams||[]).map(t=>t.name).join(', ');
        tr.innerHTML = `
          <td>${escapeHtml(g.name||'')}</td>
          <td class="small">${g.id}</td>
          <td>${g.winCondition==='AllFlagsOneTeam'?'Kaikki liput yhdellä':'Eniten pisteitä aikarajassa'}</td>
          <td>${timeTxt}</td>
          <td>${escapeHtml(teamsTxt)}</td>
          <td>
            <div class="row">
              <button data-act="flags">Avaa lipunhallinta</button>
            </div>
          </td>
        `;
        tr.querySelector('[data-act="flags"]').onclick = () => {
          const url = `${location.origin}/admin-flags/flags.html?api=${encodeURIComponent(state.apiBase)}&gameId=${g.id}`;
          window.open(url, '_blank');
        };
        tbody.appendChild(tr);
      });
    }catch(e){
      console.error(e);
    }
  }

  if (state.apiBase) setTimeout(loadGames, 200);
})();