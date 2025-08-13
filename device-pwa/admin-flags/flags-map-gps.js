(function(){
  const qs = new URLSearchParams(location.search);
  const apiBase = (qs.get('api')||'').replace(/\/$/,'');
  const gameId = qs.get('gameId');
  const info = document.getElementById('info');
  const map = L.map('map', { attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  let markers = [];

  function setInfo(t){ info.textContent = t || ''; }
  function clearMarkers(){ markers.forEach(m=> map.removeLayer(m)); markers = []; }

  async function loadFlags(){
    if (!apiBase || !gameId){ setInfo('Puuttuu api/gameId'); return; }
    setInfo('Ladataan…');
    try{
      const r = await fetch(`${apiBase}/games/${gameId}/flags`);
      if (!r.ok) throw new Error(await r.text());
      const flags = await r.json();
      clearMarkers();
      const latlngs = [];
      flags.forEach(f => {
        const m = L.marker([f.lat, f.lon]).addTo(map)
          .bindPopup(`<b>${f.name||'Lippu'}</b><br/>Pisteet: ${f.points}<br/>Väri: ${f.color||'-'}`);
        markers.push(m);
        latlngs.push([f.lat, f.lon]);
      });
      if (latlngs.length){
        const b = L.latLngBounds(latlngs);
        map.fitBounds(b.pad(0.2));
      } else {
        map.setView([60.17, 24.94], 12); // oletus: Helsinki
      }
      setInfo(`Lippuja: ${flags.length}`);
    }catch(e){
      setInfo('Virhe: '+(e?.message||e));
    }
  }

  document.getElementById('refreshBtn').onclick = loadFlags;
  loadFlags();
  setInterval(loadFlags, 10000);
})();
