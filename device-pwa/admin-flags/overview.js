(function(){
  const qs = new URLSearchParams(location.search);
  const apiBase = (qs.get('api')||'').replace(/\/$/,'');
  const gameId = qs.get('gameId');
  const map = L.map('map', { attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);

  const swLat = document.getElementById('swLat');
  const swLon = document.getElementById('swLon');
  const neLat = document.getElementById('neLat');
  const neLon = document.getElementById('neLon');
  const info = document.getElementById('info');

  let markers = [];

  function key(){ return `overview_bounds_${gameId}`; }
  function setInfo(t){ info.textContent = t || ''; }
  function clearMarkers(){ markers.forEach(m=> map.removeLayer(m)); markers = []; }

  function loadSavedBounds(){
    const raw = localStorage.getItem(key());
    if (!raw) return;
    try{
      const b = JSON.parse(raw);
      swLat.value = b.swLat ?? '';
      swLon.value = b.swLon ?? '';
      neLat.value = b.neLat ?? '';
      neLon.value = b.neLon ?? '';
      if ([b.swLat,b.swLon,b.neLat,b.neLon].every(v=> Number.isFinite(v))){
        const bounds = L.latLngBounds([b.swLat,b.swLon],[b.neLat,b.neLon]);
        map.setMaxBounds(bounds);
        map.fitBounds(bounds);
      }
    }catch{}
  }

  function applyBounds(){
    const b = {
      swLat: parseFloat(swLat.value),
      swLon: parseFloat(swLon.value),
      neLat: parseFloat(neLat.value),
      neLon: parseFloat(neLon.value),
    };
    localStorage.setItem(key(), JSON.stringify(b));
    if (Object.values(b).every(v=> Number.isFinite(v))){
      const bounds = L.latLngBounds([b.swLat,b.swLon],[b.neLat,b.neLon]);
      map.setMaxBounds(bounds);
      map.fitBounds(bounds);
      setInfo('Rajaus lukittu.');
    } else {
      setInfo('Syötä kaikki 4 arvoa.');
    }
  }

  function clearBounds(){
    map.setMaxBounds(null);
    localStorage.removeItem(key());
    setInfo('Lukitus poistettu.');
  }

  async function loadData(){
    if (!apiBase || !gameId){ setInfo('Puuttuu api/gameId'); return; }
    setInfo('Ladataan…');
    try{
      const r = await fetch(`${apiBase}/public/games/${gameId}`);
      if (!r.ok) throw new Error(await r.text());
      const g = await r.json();
      clearMarkers();
      const latlngs = [];
      (g.flags || []).forEach(f => {
        const m = L.circleMarker([f.lat, f.lon], { radius: 7 }).addTo(map)
          .bindPopup(`<b>${f.name||'Lippu'}</b><br/>Pisteet: ${f.points}`);
        markers.push(m);
        latlngs.push([f.lat, f.lon]);
      });
      if (!map.getBounds().isValid() || !map.getMaxBounds()){
        if (latlngs.length){
          const b = L.latLngBounds(latlngs);
          map.fitBounds(b.pad(0.2));
        } else {
          map.setView([60.17, 24.94], 12);
        }
      }
      setInfo(`Lippuja: ${latlngs.length}`);
    }catch(e){
      setInfo('Virhe: '+(e?.message||e));
    }
  }

  document.getElementById('applyBtn').onclick = applyBounds;
  document.getElementById('clearBtn').onclick = clearBounds;
  document.getElementById('refreshBtn').onclick = loadData;

  loadSavedBounds();
  loadData();
  setInterval(loadData, 10000);
})();
