(function(){
  const $ = id => document.getElementById(id);
  const qs = new URLSearchParams(location.search);

  // UI-esitäytöt URL-parametreista
  $('api').value     = (qs.get('api') || '').replace(/\/$/,'');
  $('gameId').value  = qs.get('gameId') || '';     // valinnainen nyt
  $('flagSlug').value= qs.get('flag') || '';       // esim. A..J

  let device = { id:null };
  let pickedGameId = null;

  function say(t){ $('msg').textContent = t; }
  function api(path){
    const base = $('api').value.trim().replace(/\/$/,'');
    if(!base) throw new Error('API URL puuttuu');
    if(!path.startsWith('/')) path = '/' + path;
    return base + path;
  }

  async function fetchJsonSafe(url, init){
    const r = await fetch(url, init);
    const txt = await r.text();
    if(!r.ok) throw new Error(txt || `HTTP ${r.status}`);
    if(!txt || !txt.trim()) return null;
    try { return JSON.parse(txt); } catch { return null; }
  }

  // 1) Hae uusin peli jos gameId puuttuu
  async function ensureGameId(){
    pickedGameId = $('gameId').value.trim();
    if (pickedGameId) return pickedGameId;

    say('Haetaan uusin peli…');
    const list = await fetchJsonSafe(api('/games'));
    if (Array.isArray(list) && list.length){
      pickedGameId = list[0].id || list[0].Id;
      $('gameId').value = pickedGameId;   // näytä se kentässä
      say('Uusin peli valittu ✓');
      return pickedGameId;
    }
    throw new Error('Pelejä ei löytynyt. Luo peli admin-portaalissa.');
  }

  // 2) Aktivoi lippu (slug A..J) tälle laitteelle
  $('activate').onclick = async ()=>{
    try{
      const gid = await ensureGameId();
      const slug = $('flagSlug').value.trim();
      if(!slug){ say('Anna lippu (esim. A)'); return; }

      const body = {
        gameId: gid,
        flagSlug: slug,
        name: ($('name').value.trim() || null)
      };

      const data = await fetchJsonSafe(api('/device/register'), {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body)
      });

      device.id = (data && (data.deviceId || data.id)) || null;
      if(!device.id) throw new Error('deviceId puuttuu vastauksesta');

      $('ctx').textContent = `Aktivoitu: ${slug} • deviceId=${device.id}`;
      say('Lippu aktivoitu ✓');
    }catch(e){
      say('Virhe aktivoinnissa: '+(e?.message||e));
    }
  };

  // 3) GPS heartbeat (15 s välein)
  let timer = null;
  $('startHb').onclick = ()=>{
    if(!device.id){ say('Aktivoi lippu ensin.'); return; }
    if(timer){ say('Heartbeat on jo käynnissä.'); return; }
    if(!navigator.geolocation){ say('Geolocation ei ole saatavilla.'); return; }

    say('Heartbeat käynnistetty.');
    const send = (pos)=>{
      const { latitude:lat, longitude:lon, accuracy } = pos.coords;
      fetch(api('/device/heartbeat'), {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ deviceId: device.id, lat, lon, accuracy })
      }).catch(()=>{});
    };
    const get = ()=> navigator.geolocation.getCurrentPosition(
      send, ()=>{}, { enableHighAccuracy:true, maximumAge:0, timeout:10000 }
    );
    get();
    timer = setInterval(get, 15000);
  };
})();
