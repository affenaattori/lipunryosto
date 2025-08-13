(function(){
  const qs = new URLSearchParams(location.search);
  const apiBase = (qs.get('api')||'').replace(/\/$/,'');
  const gameId = qs.get('gameId');

  const ctx = document.getElementById('ctx');
  const addInfo = document.getElementById('addInfo');
  const listInfo = document.getElementById('listInfo');
  const listHost = document.getElementById('flagsList');

  const fName = document.getElementById('fName');
  const fPoints = document.getElementById('fPoints');
  const fColor = document.getElementById('fColor');
  const addBtn = document.getElementById('addFlagBtn');
  const normalizeBtn = document.getElementById('normalizeBtn');

  const map = L.map('map', { attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  ctx.textContent = apiBase && gameId ? `API ok • gameId=${gameId}` : 'Aseta api & gameId URLissa';

  let markers = [];
  let clickMarker = null;
  let lastClickLatLng = null;

  map.setView([60.17, 24.94], 12); // default Helsinki
  map.on('click', (e) => {
    lastClickLatLng = e.latlng;
    if (clickMarker) map.removeLayer(clickMarker);
    clickMarker = L.marker(lastClickLatLng).addTo(map).bindPopup('Uuden lipun sijainti').openPopup();
  });

  function setAddInfo(t){ addInfo.textContent = t || ''; }
  function setListInfo(t){ listInfo.textContent = t || ''; }

  function clearMarkers(){ markers.forEach(m=> map.removeLayer(m)); markers = []; }

  async function fetchJson(url, init){
    const r = await fetch(url, init);
    const txt = await r.text();
    if (!r.ok) throw new Error(txt||('HTTP '+r.status));
    return txt ? JSON.parse(txt) : null;
  }

  async function loadFlags(){
    if (!apiBase || !gameId){ setListInfo('Puuttuu api/gameId'); return; }
    setListInfo('Ladataan…');
    try{
      const flags = await fetchJson(`${apiBase}/games/${gameId}/flags`);
      renderList(flags);
      renderMarkers(flags);
      setListInfo(flags.length ? '' : 'Ei lippuja vielä.');
    }catch(e){
      setListInfo('Virhe: '+(e?.message||e));
    }
  }

  function renderMarkers(flags){
    clearMarkers();
    const latlngs = [];
    flags.forEach(f => {
      const pos = [f.lat, f.lon];
      if (Number.isFinite(pos[0]) && Number.isFinite(pos[1]) && (pos[0]!==0 || pos[1]!==0)){
        const m = L.marker(pos).addTo(map)
          .bindPopup(`<b>${esc(f.name)||'Lippu'}</b><br/>Slug: ${esc(f.slug||'–')}<br/>Pisteet: ${f.points}${f.color?`<br/>Väri: ${esc(f.color)}`:''}`);
        markers.push(m);
        latlngs.push(pos);
      }
    });
    if (latlngs.length){
      const b = L.latLngBounds(latlngs);
      map.fitBounds(b.pad(0.2));
    }
  }

  function renderList(flags){
    listHost.innerHTML = '';
    flags.forEach(f=>{
      const div = document.createElement('div');
      div.className = 'flag-item';
      div.innerHTML = `
        <div class="flag-title">
          ${esc(f.name)||'Lippu'} 
          ${f.slug?`<span class="chip">Slug: ${esc(f.slug)}</span>`:''}
          <span class="chip">Pisteet: ${f.points}</span>
          ${f.color?`<span class="color-swatch" style="background:${esc(f.color)}"></span>`:''}
        </div>
        <div class="muted">ID: ${f.id}</div>
      `;
      listHost.appendChild(div);
    });
  }

  // Lisää lippu
  addBtn.onclick = async ()=>{
    if (!apiBase || !gameId){ setAddInfo('Puuttuu api/gameId'); return; }
    const name = fName.value.trim();
    const points = parseInt(fPoints.value||'10',10);
    const color = fColor.value.trim() || null;

    // Sijainti: klikkimerkki tai kartan keskikoordinaatti
    const center = map.getCenter();
    const lat = lastClickLatLng ? lastClickLatLng.lat : center.lat;
    const lon = lastClickLatLng ? lastClickLatLng.lng : center.lng;

    if (!name){ setAddInfo('Anna nimi.'); return; }

    const payload = { name, points, color, lat, lon };

    // yritä POST /games/{id}/flags
    setAddInfo('Lisätään…');
    try{
      await fetchJson(`${apiBase}/games/${gameId}/flags`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      setAddInfo('Lisätty ✓');
      fName.value=''; fPoints.value='10'; fColor.value='';
      if (clickMarker){ map.removeLayer(clickMarker); clickMarker=null; lastClickLatLng=null; }
      loadFlags();
      return;
    }catch(e1){
      // fallback: POST /flags (sisältää gameId)
      try{
        await fetchJson(`${apiBase}/flags`, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ gameId, ...payload })
        });
        setAddInfo('Lisätty ✓');
        fName.value=''; fPoints.value='10'; fColor.value='';
        if (clickMarker){ map.removeLayer(clickMarker); clickMarker=null; lastClickLatLng=null; }
        loadFlags();
        return;
      }catch(e2){
        setAddInfo('Virhe lisäyksessä: '+(e2?.message||e1?.message||'tuntematon virhe'));
      }
    }
  };

  // Normalisoi A…J
  normalizeBtn.onclick = async ()=>{
    if (!apiBase || !gameId){ setAddInfo('Puuttuu api/gameId'); return; }
    setAddInfo('Normalisoidaan…');
    try{
      await fetchJson(`${apiBase}/games/${gameId}/flags/normalize-slugs`, { method:'POST' });
      setAddInfo('Slugit päivitetty A…J ✓');
      loadFlags();
    }catch(e){
      setAddInfo('Virhe normalisoinnissa: '+(e?.message||e));
    }
  };

  function esc(s){ return (s??'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  loadFlags();
  setInterval(loadFlags, 10000);
})();
