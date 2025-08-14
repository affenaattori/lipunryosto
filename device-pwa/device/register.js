// register.js — yksittäinen helper rekisteröintiin
async function registerDevice(apiBase, gameId, flagSlug, name){
  if(!apiBase) throw new Error('API-osoite puuttuu');
  const url = apiBase.replace(/\/$/,'') + '/device/register';
  const body = { gameId, flagSlug, name: (name||null) };

  const r = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });

  const txt = await r.text();
  if(!r.ok) throw new Error(txt || ('HTTP '+r.status));

  // voi olla tyhjäkin → yritä jäsentää, muuten palauta minimi
  if(!txt.trim()) return { ok:true };
  try { return JSON.parse(txt); } catch { return { ok:true }; }
}
