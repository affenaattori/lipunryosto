(function(){
  const $ = (id)=>document.getElementById(id);
  const log = (m)=>{ const el=$("log"); el.textContent += `[${new Date().toLocaleTimeString()}] ${m}\n`; el.scrollTop = el.scrollHeight; };

  const state = {
    apiBase: '',
    publicToken: '',
    otp: '',
    deviceId: null,
    deviceToken: null,
    gameId: null,
    flags: [],
    selectedFlag: null,
    teams: [],
    teamId: null,
    captureTime: 60,
    countdown: 0,
    geoFence: 50,
    coords: null,
    queue: JSON.parse(localStorage.getItem('queue')||'[]')
  };

  const setConn = ()=>{ $("conn").textContent = navigator.onLine? "Online":"Offline"; $("conn").style.color = navigator.onLine? "#10b981":"#f59e0b"; };
  window.addEventListener('online', setConn); window.addEventListener('offline', setConn); setConn();

  function startGPS(){
    if (!('geolocation' in navigator)) { $("gps").textContent = "GPS ei saatavilla"; return; }
    navigator.geolocation.watchPosition(pos=>{
      state.coords = pos.coords;
      $("gps").textContent = `GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} ±${pos.coords.accuracy|0}m`;
      renderFlagList();
    }, err=>{ $("gps").textContent = "GPS virhe"; }, { enableHighAccuracy:true, maximumAge:2000, timeout:8000 });
  }
  startGPS();

  // --- URL parametrit (api, token, otp) ---
  const params = new URLSearchParams(location.search);
  const pApi   = params.get('api');
  const pToken = params.get('token');
  const pOtp   = params.get('otp');

  if (pApi)   { $("apiBase").value = pApi; }
  if (pToken) { $("publicToken").value = pToken; }
  if (pOtp)   { $("otp").value = pOtp; }

  if (pApi && pToken) {
    setTimeout(() => { $("loadBtn").click(); }, 200);
  }

  const hexOnColor = (hex) => {
    hex = (hex||"").replace('0x','#'); if(!/^#?[0-9a-fA-F]{6}$/.test(hex)) return '#0f172a';
    const c = hex.replace('#',''); const r=parseInt(c.substr(0,2),16), g=parseInt(c.substr(2,2),16), b=parseInt(c.substr(4,2),16);
    const yiq = ((r*299)+(g*587)+(b*114))/1000;
    return yiq >= 128 ? '#0f172a' : '#ffffff';
  };

  function distMeters(aLat,aLon,bLat,bLon){
    if ([aLat,aLon,bLat,bLon].some(v=>typeof v!=='number')) return null;
    const R=6371000; const toRad=(d)=>d*Math.PI/180;
    const dLat=toRad(bLat-aLat), dLon=toRad(bLon-aLon);
    const A=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLon/2)**2;
    return Math.round(2*R*Math.atan2(Math.sqrt(A),Math.sqrt(1-A)));
  }

  function setOwnerUI(ownerTeam) {
    const ownerBar = $("ownerBar");
    if (!ownerTeam) {
      ownerBar.textContent = "Nykyinen: –";
      ownerBar.style.background = "#1f2937";
      ownerBar.style.color = "#9ca3af";
      document.body.style.background = "#0f172a";
      return;
    }
    ownerBar.textContent = `Nykyinen: ${ownerTeam.name}`;
    const color = (ownerTeam.color || "#1f2937").replace('0x','#');
    ownerBar.style.background = color;
    ownerBar.style.color = hexOnColor(color);
    document.body.style.background = color;
  }

  function renderTeamButtons(teams) {
    const wrap = $("teamButtons");
    wrap.innerHTML = "";
    teams.forEach(t => {
      const btn = document.createElement("button");
      btn.className = "team-btn";
      const color = (t.color || "#60a5fa").replace('0x','#');
      btn.style.background = color;
      btn.style.color = hexOnColor(color);
      btn.textContent = t.name || "Joukkue";
      btn.onclick = () => beginCaptureWithTeam(t);
      wrap.appendChild(btn);
    });
  }

  function renderFlagList() {
    const cont = $("flagList");
    cont.innerHTML = "";
    state.flags.forEach(f => {
      const item = document.createElement("div");
      item.className = "flag-item";
      const left = document.createElement("div");
      left.innerHTML = `<div class="flag-name">${f.name || "Lippu"}</div><div class="flag-meta">Pisteet: ${f.points} • ${f.status}</div>`;
      const right = document.createElement("div");
      let dist = null;
      if (state.coords && typeof f.lat === 'number' && typeof f.lon === 'number') {
        dist = distMeters(state.coords.latitude, state.coords.longitude, f.lat, f.lon);
      }
      right.textContent = dist!=null ? `${dist} m` : "";
      item.appendChild(left); item.appendChild(right);
      item.onclick = () => selectFlag(f);
      cont.appendChild(item);
    });
  }

  function selectFlag(flag) {
    state.selectedFlag = flag;
    $("flagCard").style.display = "none";
    $("captureCard").style.display = "block";
    $("hint").textContent = `Valittu lippu: ${flag.name || flag.id}`;
    hydrateTeamsAndOwner();
  }

  async function hydrateFromPublicToken(){
    try{
      const r = await fetch(`${$("apiBase").value.trim().replace(/\/$/,'')}/public/games/${$("publicToken").value.trim()}`);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      state.apiBase = $("apiBase").value.trim().replace(/\/$/,'');
      state.publicToken = $("publicToken").value.trim();
      state.otp = $("otp").value.trim();
      state.gameId = data.game.id;
      state.teams = data.teams || [];
      state.flags = data.flags || [];
      renderFlagList();
      renderTeamButtons(state.teams);
      $("tokenCard").style.display = "none";
      $("flagCard").style.display = "block";
      log(`Peli haettu tokenilla, gameId=${state.gameId}`);

      const r2 = await fetch(`${state.apiBase}/device/open`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ gameId: state.gameId, otp: state.otp, name: 'web-pwa' })
      });
      if (!r2.ok) throw new Error(await r2.text());
      const auth = await r2.json();
      state.deviceId = auth.deviceId; state.deviceToken = auth.deviceToken;
      log("Laite avattu");
      $("baseUrlInfo").textContent = state.apiBase;
      const g = await fetch(`${state.apiBase}/games/${state.gameId}`);
      if (g.ok) {
        const game = await g.json();
        state.captureTime = game.captureTimeSeconds || 60;
        $("capTime").value = state.captureTime;
      }
    }catch(e){
      $("tokenInfo").textContent = "Virhe pelin haussa tai OTP:ssa.";
      log("Virhe token/otp: " + e);
    }
  }

  async function hydrateTeamsAndOwner() {
    try {
      const flagId = state.selectedFlag?.id;
      if (!flagId) return;
      const res = await fetch(`${state.apiBase}/flags/${flagId}`);
      let ownerTeam = null;
      if (res.ok) {
        const f = await res.json();
        if (f.ownerTeamId) {
          ownerTeam = state.teams.find(t => t.id === f.ownerTeamId) || null;
        } else if (f.color && state.teams.length) {
          const norm = (x)=> (x||"").toLowerCase();
          ownerTeam = state.teams.find(t => norm(t.color) === norm(f.color)) || null;
        }
      }
      setOwnerUI(ownerTeam);
    } catch(e) {
      console.warn("Owner hydrate failed", e);
    }
  }

  function beginCaptureWithTeam(team) {
    if (!state.selectedFlag) { $("hint").textContent = "Valitse ensin lippupiste listasta."; return; }
    state.teamId = team.id;
    $("hint").textContent = `Valtaus: ${team.name} → ${state.selectedFlag.name || state.selectedFlag.id}`;
    $("startBtn").click();
  }

  function enqueue(req){
    state.queue.push(req);
    localStorage.setItem('queue', JSON.stringify(state.queue));
  }
  async function flush(){
    if (!navigator.onLine) { log("Offline, jonot odottavat"); return; }
    const next = [];
    for (const item of state.queue){
      try{
        const r = await fetch(item.url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(item.body) });
        if (!r.ok) throw new Error(await r.text());
        log("Lähetetty: " + item.kind);
      }catch(e){
        log("Lähetys epäonnistui: " + item.kind);
        next.push(item);
      }
    }
    state.queue = next;
    localStorage.setItem('queue', JSON.stringify(state.queue));
  }
  $("flushBtn").onclick = flush;
  setInterval(flush, 5000);

  $("loadBtn").onclick = async ()=>{
    const api = $("apiBase").value.trim();
    const token = $("publicToken").value.trim();
    const otp = $("otp").value.trim();
    if (!api || !token || !otp) { $("tokenInfo").textContent = "Täytä API, token ja OTP."; return; }
    $("tokenInfo").textContent = "Haetaan peliä…";
    await hydrateFromPublicToken();
  };

  $("startBtn").onclick = async ()=>{
    if (!state.teamId || !state.selectedFlag) { $("hint").textContent = "Valitse joukkue ja lippu."; return; }
    const body = {
      teamId: state.teamId,
      phase: "start",
      lat: state.coords?.latitude, lon: state.coords?.longitude, accuracy: state.coords?.accuracy
    };
    const url = `${state.apiBase}/device/flags/${state.selectedFlag.id}/capture`;
    enqueue({ kind:'start', url, body });
    log("Start jonossa");
    flush();
    state.captureTime = +$("capTime").value || 60;
    state.countdown = state.captureTime;
    $("confirmBtn").disabled = true;
    $("hint").textContent = "Odota vahvistusaika ja pysy alueella.";
    const iv = setInterval(()=>{
      state.countdown--;
      $("timer").textContent = state.countdown + " s";
      if (state.countdown <= 0){
        $("confirmBtn").disabled = false;
        $("hint").textContent = "Voit vahvistaa vallauksen.";
        clearInterval(iv);
      }
    }, 1000);
  };

  $("confirmBtn").onclick = async ()=>{
    if (!state.teamId || !state.selectedFlag) { $("hint").textContent = "Valitse joukkue ja lippu."; return; }
    const body = {
      teamId: state.teamId,
      phase: "confirm",
      lat: state.coords?.latitude, lon: state.coords?.longitude, accuracy: state.coords?.accuracy
    };
    const url = `${state.apiBase}/device/flags/${state.selectedFlag.id}/capture`;
    enqueue({ kind:'confirm', url, body });
    log("Confirm jonossa");
    flush();
    $("confirmBtn").disabled = true;
    $("timer").textContent = "--";
    $("hint").textContent = "Lähetetty. Jos ei onnistu heti, lähtee automaattisesti kun yhteys palaa.";
    hydrateTeamsAndOwner();
  };
})();