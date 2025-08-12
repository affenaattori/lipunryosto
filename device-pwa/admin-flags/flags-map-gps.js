(function(){
  const $ = (id)=>document.getElementById(id);
  const info = $("info");
  const tbody = $("flagsTbody");
  const empty = $("empty");

  const state = {
    apiBase: localStorage.getItem("admin_apiBase") || "",
    gameId: localStorage.getItem("admin_gameId") || "",
    flags: [],
    selectedFlagId: null,
    lastGps: null,
    map: {
      url: localStorage.getItem("admin_map_url") || "/admin-flags/map.png",
      north: parseFloat(localStorage.getItem("admin_map_north") || "") || null,
      south: parseFloat(localStorage.getItem("admin_map_south") || "") || null,
      west:  parseFloat(localStorage.getItem("admin_map_west")  || "") || null,
      east:  parseFloat(localStorage.getItem("admin_map_east")  || "") || null,
      img: null,
      canvas: null,
      ctx: null,
      lastClick: null // {lat,lon,x,y}
    }
  };

  // URL params override
  const params = new URLSearchParams(location.search);
  if (params.get("api")) state.apiBase = params.get("api");
  if (params.get("gameId")) state.gameId = params.get("gameId");

  $("apiBase").value = state.apiBase;
  $("gameId").value = state.gameId;

  // Map UI fields
  $("mapUrl").value = state.map.url;
  if (state.map.north!=null) $("north").value = state.map.north;
  if (state.map.south!=null) $("south").value = state.map.south;
  if (state.map.west!=null)  $("west").value  = state.map.west;
  if (state.map.east!=null)  $("east").value  = state.map.east;

  function setInfo(msg){ info.textContent = msg || ""; }
  function api(path){ return `${state.apiBase.replace(/\/$/,"")}${path}`; }

  // ---------- Flags table ----------
  function render(){
    tbody.innerHTML = "";
    if (!state.flags.length){ empty.style.display="block"; return; }
    empty.style.display="none";
    state.flags.forEach(f => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="radio" name="sel" ${state.selectedFlagId===f.id?'checked':''}></td>
        <td><input data-k="Name" value="${escapeHtml(f.name||'')}" /></td>
        <td><input data-k="Lat"  value="${f.lat ?? ''}" /></td>
        <td><input data-k="Lon"  value="${f.lon ?? ''}" /></td>
        <td><input data-k="Points" type="number" min="0" value="${f.points ?? 0}" /></td>
        <td><input data-k="Color" value="${escapeHtml(f.color||'')}" /></td>
        <td>
          <select data-k="Status">
            ${["open","closed"].map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
        <td class="actions">
          <button data-act="save">Tallenna</button>
        </td>
      `;
      tr.querySelector('input[type="radio"]').onclick = ()=>{ state.selectedFlagId = f.id; };
      tr.querySelector('[data-act="save"]').onclick = async () => {
        const payload = collect(tr);
        await patchFlag(f.id, payload);
      };
      tbody.appendChild(tr);
    });
    drawMap(); // update markers
  }

  function collect(tr){
    const map = {};
    tr.querySelectorAll("input,select").forEach(el => {
      const k = el.getAttribute("data-k");
      let v = el.value;
      if (k === "Lat" || k === "Lon" || k === "Points"){
        v = v === "" ? null : Number(v);
      }
      map[k] = v;
    });
    return map;
  }

  async function loadFlags(){
    if (!state.apiBase || !state.gameId){ setInfo("Täytä API ja GameId."); return; }
    setInfo("Ladataan…");
    try{
      const r = await fetch(api(`/games/${state.gameId}/flags`));
      if (!r.ok) throw new Error(await r.text());
      state.flags = await r.json();
      render();
      setInfo(`Ladattu ${state.flags.length} lippua.`);
    }catch(e){
      setInfo("Virhe: " + (e?.message||e));
    }
  }

  async function patchFlag(flagId, payload){
    setInfo("Tallennetaan…");
    try{
      const r = await fetch(api(`/flags/${flagId}`), {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(await r.text());
      setInfo("Tallennettu ✓");
      await loadFlags();
    }catch(e){
      setInfo("Virhe tallennuksessa: " + (e?.message||e));
    }
  }

  async function addFlagFromForm(){
    if (!state.apiBase || !state.gameId){ setInfo("Täytä API ja GameId."); return; }
    const lat = parseFloat($("newLat").value);
    const lon = parseFloat($("newLon").value);
    const points = parseInt($("newPoints").value||"10",10)||10;
    const color = $("newColor").value || "blue";
    if (Number.isNaN(lat) || Number.isNaN(lon)){ setInfo("Anna kelvollinen lat/lon."); return; }
    setInfo("Luodaan lippua…");
    try{
      const r = await fetch(api(`/games/${state.gameId}/flags`), {
        method:"POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ lat, lon, points, color })
      });
      if (!r.ok) throw new Error(await r.text());
      const created = await r.json();
      setInfo(`Luotu: ${created.name}`);
      $("newLat").value = ""; $("newLon").value = "";
      await loadFlags();
    }catch(e){
      setInfo("Virhe luonnissa: " + (e?.message||e));
    }
  }

  async function useMyGps(){
    if (!('geolocation' in navigator)){ setInfo("Selaimella ei ole GPS-tukea."); return; }
    setInfo("Haetaan GPS-sijaintia…");
    navigator.geolocation.getCurrentPosition((pos)=>{
      const { latitude, longitude, accuracy } = pos.coords;
      $("newLat").value = latitude.toFixed(6);
      $("newLon").value = longitude.toFixed(6);
      state.lastGps = { lat: latitude, lon: longitude, accuracy: accuracy|0 };
      setInfo(`GPS ok (±${state.lastGps.accuracy}m).`);
    }, (err)=>{
      setInfo("GPS-virhe: " + (err && err.message ? err.message : "Tuntematon virhe"));
    }, { enableHighAccuracy:true, maximumAge:2000, timeout:10000 });
  }

  async function normalizeNames(){
    if (!state.apiBase || !state.gameId){ setInfo("Täytä API ja GameId."); return; }
    if (!confirm("Normalisoidaanko nimet järjestykseen Lippupiste A, B, C…?")) return;
    setInfo("Normalisoidaan…");
    try{
      const r = await fetch(api(`/games/${state.gameId}/flags/normalize-names`), { method:"POST" });
      if (!r.ok) throw new Error(await r.text());
      setInfo("Valmis ✓");
      await loadFlags();
    }catch(e){
      setInfo("Virhe normalisoinnissa: " + (e?.message||e));
    }
  }

  function saveCfg(){
    state.apiBase = $("apiBase").value.trim();
    state.gameId = $("gameId").value.trim();
    localStorage.setItem("admin_apiBase", state.apiBase);
    localStorage.setItem("admin_gameId", state.gameId);
    setInfo("Asetukset tallennettu.");
  }

  // ---------- Map logic ----------
  const canvas = $("mapCanvas");
  const ctx = canvas.getContext("2d");
  state.map.canvas = canvas; state.map.ctx = ctx;

  function saveMapCfg(){
    state.map.url   = $("mapUrl").value.trim() || "/admin-flags/map.png";
    state.map.north = parseFloat($("north").value);
    state.map.south = parseFloat($("south").value);
    state.map.west  = parseFloat($("west").value);
    state.map.east  = parseFloat($("east").value);
    localStorage.setItem("admin_map_url", state.map.url);
    if (!Number.isNaN(state.map.north)) localStorage.setItem("admin_map_north", state.map.north);
    if (!Number.isNaN(state.map.south)) localStorage.setItem("admin_map_south", state.map.south);
    if (!Number.isNaN(state.map.west))  localStorage.setItem("admin_map_west",  state.map.west);
    if (!Number.isNaN(state.map.east))  localStorage.setItem("admin_map_east",  state.map.east);
    drawMap();
    setInfo("Kartta-asetukset tallennettu.");
  }

  function loadMap(){
    const url = $("mapUrl").value.trim() || "/admin-flags/map.png";
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      state.map.img = img;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      drawMap();
      setInfo("Kartta ladattu.");
    };
    img.onerror = () => setInfo("Kartan lataus epäonnistui. Tarkista URL.");
    img.src = url;
  }

  function latLonToXY(lat, lon){
    const {north,south,west,east,img} = state.map;
    if (img==null || north==null || south==null || west==null || east==null) return null;
    const x = ( (lon - west) / (east - west) ) * img.naturalWidth;
    const y = ( (north - lat) / (north - south) ) * img.naturalHeight;
    return {x, y};
  }
  function xyToLatLon(x, y){
    const {north,south,west,east,img} = state.map;
    if (img==null || north==null || south==null || west==null || east==null) return null;
    const lon = west + (x / img.naturalWidth) * (east - west);
    const lat = north - (y / img.naturalHeight) * (north - south);
    return {lat, lon};
  }

  function drawMap(){
    const {img} = state.map;
    if (!img) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img, 0, 0);
    // draw existing flags
    if (state.map.north!=null && state.map.south!=null && state.map.west!=null && state.map.east!=null){
      ctx.save();
      ctx.fillStyle = "rgba(96,165,250,0.9)"; // markers
      ctx.strokeStyle = "rgba(15,23,42,0.9)";
      ctx.lineWidth = 2;
      for (const f of state.flags){
        if (typeof f.lat !== "number" || typeof f.lon !== "number") continue;
        const p = latLonToXY(f.lat, f.lon);
        if (!p) continue;
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
      // last click marker
      if (state.map.lastClick){
        const p = state.map.lastClick;
        ctx.fillStyle = "rgba(16,185,129,0.9)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }

  canvas.addEventListener("click", (ev)=>{
    if (!state.map.img) return;
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const y = (ev.clientY - rect.top)  * (canvas.height / rect.height);
    const latlon = xyToLatLon(x, y);
    if (!latlon){ setInfo("Aseta ensin kartan rajat (north/south/west/east)."); return; }
    state.map.lastClick = {x,y,lat:latlon.lat,lon:latlon.lon};
    $("cursorLatLon").textContent = `Lat,Lon: ${latlon.lat.toFixed(6)}, ${latlon.lon.toFixed(6)}`;
    $("newLat").value = latlon.lat.toFixed(6);
    $("newLon").value = latlon.lon.toFixed(6);
    drawMap();
  });

  async function updateSelectedPosFromClick(){
    if (!state.selectedFlagId){ setInfo("Valitse ensin lippu taulukosta."); return; }
    // prefer last click on map, else last GPS
    let latlon = state.map.lastClick ? { lat: state.map.lastClick.lat, lon: state.map.lastClick.lon } : state.lastGps;
    if (!latlon){ setInfo("Klikkaa karttaa tai hae GPS ensin."); return; }
    await patchFlag(state.selectedFlagId, { Lat: latlon.lat, Lon: latlon.lon });
  }

  function focusSelectedOnMap(){
    if (!state.selectedFlagId){ setInfo("Valitse ensin lippu taulukosta."); return; }
    const f = state.flags.find(x => x.id === state.selectedFlagId);
    if (!f || typeof f.lat !== "number" || typeof f.lon !== "number"){ setInfo("Valitulla lipulla ei ole sijaintia."); return; }
    const p = latLonToXY(f.lat, f.lon);
    if (!p){ setInfo("Aseta ensin kartan rajat (north/south/west/east)."); return; }
    state.map.lastClick = {x:p.x, y:p.y, lat:f.lat, lon:f.lon};
    $("cursorLatLon").textContent = `Lat,Lon: ${f.lat.toFixed(6)}, ${f.lon.toFixed(6)}`;
    drawMap();
  }

  // helpers
  function escapeHtml(s){
    return (s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  // wire buttons
  $("saveCfgBtn").onclick = ()=>{ saveCfg(); };
  $("loadBtn").onclick = loadFlags;
  $("addFlagBtn").onclick = addFlagFromForm;
  $("normalizeBtn").onclick = normalizeNames;
  $("loadMapBtn").onclick = loadMap;
  $("saveMapCfgBtn").onclick = saveMapCfg;
  $("useMyGpsBtn").onclick = useMyGps;
  $("createHereBtn").onclick = addFlagFromForm;
  $("updateSelectedPosBtn").onclick = updateSelectedPosFromClick;
  $("focusSelectedBtn").onclick = focusSelectedOnMap;

  // auto-load flags if config present
  if (state.apiBase && state.gameId){ setTimeout(loadFlags, 200); }
  // auto-load map if url set
  if (state.map.url) setTimeout(loadMap, 200);
})();