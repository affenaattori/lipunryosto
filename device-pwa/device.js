(function(){
  const $ = id => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  $('api').value = qs.get('api') || '';
  $('gameId').value = qs.get('gameId') || '';
  $('flagSlug').value = qs.get('flag') || '';

  let device = { id:null };

  function say(t){ $('msg').textContent = t; }

  function api(path){ return $('api').value.replace(/\/$/,'') + path; }

  $('activate').onclick = async ()=>{
    try{
      const r = await fetch(api('/device/register'), {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          gameId: $('gameId').value.trim(),
          flagSlug: $('flagSlug').value.trim(),
          name: $('name').value.trim() || null
        })
      });
      const txt = await r.text();
      if(!r.ok) throw new Error(txt||('HTTP '+r.status));
      const data = txt ? JSON.parse(txt) : {};
      device.id = data.deviceId || data.id;
      $('ctx').textContent = `Aktivoitu: ${$('flagSlug').value.trim()} • deviceId=${device.id}`;
      say('Lippu aktivoitu ✓');
    }catch(e){
      say('Virhe aktivoinnissa: '+(e?.message||e));
    }
  };

  let timer = null;
  $('startHb').onclick = ()=>{
    if(!device.id){ say('Aktivoi lippu ensin.'); return; }
    if(timer) { say('Heartbeat jo käynnissä.'); return; }
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
    const get = ()=> navigator.geolocation.getCurrentPosition(send, ()=>{}, { enableHighAccuracy:true, maximumAge:0, timeout:10000 });
    get();
    timer = setInterval(get, 15000);
  };
})();
