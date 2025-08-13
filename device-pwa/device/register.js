// register.js
async function registerDevice(apiBase, gameId, flagSlug, name) {
    const res = await fetch(`${apiBase}/device/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            gameId: gameId,
            flagSlug: flagSlug,
            name: name
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Registration failed: ${err}`);
    }

    const data = await res.json();
    localStorage.setItem("deviceId", data.deviceId);
    localStorage.setItem("flagId", data.flagId);
    localStorage.setItem("flagSlug", data.flagSlug);
    console.log("Registered device", data);
    return data;
}
