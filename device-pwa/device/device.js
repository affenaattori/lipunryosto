(function(){
  const $ = id => document.getElementById(id);
  const qs = new URLSearchParams(location.search);

  // Esitäytä kentät URL-parametreista tai localStoragesta
  $('api').value      = (qs.get('api') || localStorage.getItem('dev_api') || '').replace(/\/$/,'');
  $('flagSlug').value = (qs.get('flag') || localStorage.getItem('dev_flag') || '');
  $('name').value     = (localStorage.getItem('dev_name') || '');

  let device = {
    id:   localStorage.getItem('deviceId') || null,
    flag: localStorage.getItem('dev_flag') || null
  };
  let pickedGameId = null;
  let hbTimer = null;

  function say(t){ $('msg').textContent = t; }
  function setCtx(){
    const parts = [];
    if (device.id) parts.push(`deviceId=${device.id}`);
    if (device.flag) parts.push(`lippu=${device.flag}`);
    $('ctx').textContent = parts.length ? parts.join(' • ') : '–';
  }
  setCtx();

  function api(path){
    const base = $('api').value.trim().replace(/\/$/,'');
    if(!base) throw new Error('API-osoite puuttuu');
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

  // Hae uusin peli jos gameId puuttuu (emme näytä kenttää, logiikka hoitaa)
  async function ensureGameId(){
    if (pickedGameId) return pickedGameId;
    say('Haetaan uusin peli…');
    const list = await fetchJsonSafe(api('/games'));
    if (Array.isArray(list) && list.length){
      pickedGameId = list[0].id || list[0].Id;
      say('Uusin peli valittu ✓');
      return pickedGameId;
    }
    throw new Error('Pelejä ei löytynyt. Luo peli admin-portaalissa.');
  }

  // Aktivoi lippu (slug A..J)
  $('activate').onclick = async ()=>{
    try{
      const base = $('api').value.trim();
      if(!base){ say('Aseta API-osoite'); return; }

      const gid = await ensureGameId();
      const slug = $('flagSlug').value.trim().toUpperCase();
      if(!slug){ say('Anna lippu (esim. A)'); return; }
      if(slug.length!==1 || slug<'A' || slug>'J'){ say('Lipun pitää olla A..J'); return; }

      const name = $('name').value.trim();
      localStorage.setItem('dev_api', base);
      localStorage.setItem('dev_flag', slug);
      localStorage.setItem('dev_name', name);

      const res = await registerDevice(base, gid, slug, name);
      // odotettu vastemuoto: { deviceId, flagId, flagSlug, gameId }
      if (res?.deviceId) {
        device.id = res.deviceId;
        localStorage.setItem('deviceId', device.id);
      }
      device.flag = slug;
      setCtx();
      say('Lippu aktivoitu ✓');
    }catch(e){
      say('Virhe aktivoinnissa: '+(e?.message||e));
    }
  };

  // Heartbeat on/off
  $('startHb').onclick = ()=>{
    if(!device.id){ say('Aktivoi lippu ensin.'); return; }
    if(hbTimer){ say('Heartbeat on jo käynnissä.'); return; }
    if(!navigator.geolocation){ say('Geolocation ei ole saatavilla.'); return; }

    say('Heartbeat käynnistetty (15 s välein).');
    const send = (pos)=>{
      const { latitude:lat, longitude:lon, accuracy } = pos.coords;
      fetch(api('/device/heartbeat'), {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ deviceId: device.id, lat, lon, accuracy })
      })
      .then(()=>{ /* ok */ })
      .catch(()=>{ /* hiljaa */ });
    };
    const get = ()=> navigator.geolocation.getCurrentPosition(
      send, ()=>{}, { enableHighAccuracy:true, maximumAge:0, timeout:10000 }
    );
    get();
    hbTimer = setInterval(get, 15000);
  };

  $('stopHb').onclick = ()=>{
    if(hbTimer){ clearInterval(hbTimer); hbTimer=null; say('Heartbeat pysäytetty.'); }
    else say('Heartbeat ei ollut käynnissä.');
  };

  // Jos deviceId oli tallessa, kerrotaan käyttäjälle että voi suoraan käynnistää GPS:n
  if (device.id) say('Laite muistissa — voit käynnistää GPS heartbeatin heti.');
})();
