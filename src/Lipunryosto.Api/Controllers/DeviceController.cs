using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Lipunryosto.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Lipunryosto.Api.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace Lipunryosto.Api.Controllers;

[ApiController]
[Route("device")]
public class DeviceController : ControllerBase
{
    private readonly AppDb _db;
    private readonly OtpService _otp;
    private readonly ScoringService _scoring;
    private readonly IOptions<CaptureOptions> _cap; // varalla future-käyttöön
    private readonly IHubContext<AdminHub> _admin;
    private readonly IHubContext<PublicHub> _public;

    public DeviceController(
        AppDb db,
        OtpService otp,
        ScoringService scoring,
        IOptions<CaptureOptions> cap,
        IHubContext<AdminHub> admin,
        IHubContext<PublicHub> pub)
    {
        _db = db; _otp = otp; _scoring = scoring; _cap = cap; _admin = admin; _public = pub;
    }

    // -------- /device/open --------
    public record DeviceOpenDto(Guid GameId, string Otp, string? Name);

    /// <summary>
    /// Avaa laitteen peliin OTP:llä ja palauttaa laitteen id + kertakäyttöisen tokenin.
    /// </summary>
    [HttpPost("open")]
    public async Task<IActionResult> Open([FromBody] DeviceOpenDto dto)
    {
        var g = await _db.Games.FirstOrDefaultAsync(x => x.Id == dto.GameId);
        if (g is null || string.IsNullOrWhiteSpace(g.OtpHash)) return Unauthorized();

        if (!_otp.Verify(dto.Otp, g.OtpHash)) return Unauthorized();

        var d = new Device { GameId = g.Id, Name = dto.Name };
        _db.Devices.Add(d);
        await _db.SaveChangesAsync();

        // luodaan session-token (säilötään hash-kenttään nykyisessä mallissa)
        var token = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        d.DeviceTokenHash = token;
        await _db.SaveChangesAsync();

        return Ok(new { deviceId = d.Id, deviceToken = token, assignedFlagId = d.AssignedFlagId });
    }

// -------- /device/{deviceId}/assign-flag/{flagId} --------
[HttpPost("{deviceId:guid}/assign-flag/{flagId:guid}")]
public async Task<IActionResult> AssignFlag(Guid deviceId, Guid flagId)
{
    var dev = await _db.Devices.FirstOrDefaultAsync(d => d.Id == deviceId);
    if (dev == null) return NotFound(new { error = "device_not_found" });

    var flag = await _db.Flags.FirstOrDefaultAsync(f => f.Id == flagId);
    if (flag == null) return NotFound(new { error = "flag_not_found" });

    // Jos laitteella ei ole vielä peliä, sidotaan se lipun peliin
    if (!dev.GameId.HasValue)
    {
        dev.GameId = flag.GameId;
    }
    else if (dev.GameId.Value != flag.GameId)
    {
        // Estetään ristiin-paritus väärään peliin
        return Conflict(new { error = "different_game", deviceGameId = dev.GameId, flagGameId = flag.GameId });
    }

    dev.AssignedFlagId = flag.Id;
    await _db.SaveChangesAsync();

    // Ilmoita admin- ja julkiselle hubille (valinnainen)
    await _admin.Clients.All.SendAsync("deviceAssigned", new { deviceId = dev.Id, flagId = flag.Id, gameId = flag.GameId });
    await _public.Clients.All.SendAsync("deviceAssigned", new { deviceId = dev.Id, flagId = flag.Id, gameId = flag.GameId });

    return Ok(new { ok = true, deviceId = dev.Id, assignedFlagId = dev.AssignedFlagId, gameId = dev.GameId });
}

// -------- /device/{deviceId}/unassign --------
[HttpPost("{deviceId:guid}/unassign")]
public async Task<IActionResult> UnassignFlag(Guid deviceId)
{
    var dev = await _db.Devices.FirstOrDefaultAsync(d => d.Id == deviceId);
    if (dev == null) return NotFound(new { error = "device_not_found" });

    dev.AssignedFlagId = null;
    await _db.SaveChangesAsync();

    await _admin.Clients.All.SendAsync("deviceUnassigned", new { deviceId = dev.Id, gameId = dev.GameId });
    await _public.Clients.All.SendAsync("deviceUnassigned", new { deviceId = dev.Id, gameId = dev.GameId });

    return Ok(new { ok = true });
}



    // -------- /device/heartbeat --------
    public record HeartbeatDto(Guid DeviceId, double? Lat, double? Lon, double? Accuracy);

    /// <summary>
    /// Päivittää laitteen sijainnin. Jos laite on sidottu lippuun (AssignedFlagId),
    /// päivitetään lipun Lat/Lon automaattisesti laitteen GPS:n perusteella.
    /// </summary>
    [HttpPost("heartbeat")]
    public async Task<IActionResult> Heartbeat([FromBody] HeartbeatDto dto)
    {
        var dev = await _db.Devices.FirstOrDefaultAsync(d => d.Id == dto.DeviceId);
        if (dev == null) return NotFound(new { error = "device_not_found" });

        // 1) Päivitä laitteen tiedot
        dev.Lat = dto.Lat;
        dev.Lon = dto.Lon;
        dev.AccuracyMeters = dto.Accuracy;
        dev.LastSeen = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        // 2) Jos laite on sidottu lippuun, peilaa koordinaatit lippuun
        if (dev.AssignedFlagId.HasValue && dto.Lat.HasValue && dto.Lon.HasValue)
        {
            var flag = await _db.Flags.FirstOrDefaultAsync(x => x.Id == dev.AssignedFlagId.Value);
            if (flag != null)
            {
                // Halutessasi: mittaa ero ja päivitä vain jos liike > X m
                // var moved = GeoHelper.Haversine(flag.Lat, flag.Lon, dto.Lat.Value, dto.Lon.Value);
                // if (moved > 3.0) { ... }

                flag.Lat = dto.Lat.Value;
                flag.Lon = dto.Lon.Value;
                await _db.SaveChangesAsync();

                // ilmoita admin/julkiselle että lipun sijainti päivittyi
                await _admin.Clients.All.SendAsync("flagUpdated", new
                {
                    gameId = flag.GameId,
                    flagId = flag.Id,
                    lastCapturedAt = flag.LastCapturedAt,
                    ownerTeamId = flag.OwnerTeamId,
                    lat = flag.Lat,
                    lon = flag.Lon
                });
                await _public.Clients.All.SendAsync("flagUpdated", new
                {
                    gameId = flag.GameId,
                    flagId = flag.Id,
                    lastCapturedAt = flag.LastCapturedAt,
                    ownerTeamId = flag.OwnerTeamId,
                    lat = flag.Lat,
                    lon = flag.Lon
                });
            }
        }

        return Ok(new { ok = true });
    }

    // -------- /device/flags/{flagId}/capture --------
    public record CaptureDto(Guid TeamId, string Phase, double? Lat, double? Lon, double? Accuracy);

    /// <summary>
    /// Lippupisteen vallauksen käsittely: start → confirm (kahden vaiheen malli).
    /// </summary>
    [HttpPost("flags/{flagId:guid}/capture")]
    public async Task<IActionResult> Capture(Guid flagId, [FromBody] CaptureDto dto)
    {
        var f = await _db.Flags.FirstOrDefaultAsync(x => x.Id == flagId);
        if (f is null) return NotFound();

        var g = await _db.Games.FirstAsync(x => x.Id == f.GameId);
        if (g.Status != GameStatus.Running) return BadRequest("Game not live");

        var now = DateTimeOffset.UtcNow;

        // talleta capture-event (start/confirm) timelinea varten
        var ev = new CaptureEvent
        {
            GameId = g.Id,
            FlagId = f.Id,
            TeamId = dto.TeamId,
            Phase = dto.Phase,
            Lat = dto.Lat,
            Lon = dto.Lon,
            Accuracy = dto.Accuracy,
            Timestamp = now
        };
        _db.Events.Add(ev);
        await _db.SaveChangesAsync();

        await _admin.Clients.All.SendAsync("eventCreated", new { gameId = g.Id, evId = ev.Id, phase = ev.Phase, flagId = f.Id, teamId = ev.TeamId, ts = ev.Timestamp });
        await _public.Clients.All.SendAsync("eventCreated", new { gameId = g.Id, evId = ev.Id, phase = ev.Phase, flagId = f.Id, teamId = ev.TeamId, ts = ev.Timestamp });

        if (string.Equals(dto.Phase, "confirm", StringComparison.OrdinalIgnoreCase))
        {
            // etsi uusin "start" samalle lipulle & tiimille
            var start = await _db.Events
                .Where(x => x.GameId == g.Id && x.FlagId == f.Id && x.TeamId == dto.TeamId && x.Phase == "start")
                .OrderByDescending(x => x.Timestamp)
                .FirstOrDefaultAsync();
            if (start is null) return BadRequest("Start not found");

            var elapsed = now - start.Timestamp;
            // pientä 10s armovaraa ennen CaptureTimeSeconds -rajaa
            if (elapsed.TotalSeconds + 10 < g.CaptureTimeSeconds)
                return BadRequest("Confirm too early");

            // (valinnainen) geo-fence
            if (dto.Lat.HasValue && dto.Lon.HasValue && f.Lat != 0 && f.Lon != 0)
            {
                var dist = GeoHelper.Haversine(f.Lat, f.Lon, dto.Lat.Value, dto.Lon.Value);
                if (dist > 50) return BadRequest("Out of geofence"); // 50 m oletus
            }

            // pisteet + omistajuus
            await _scoring.AwardAsync(g.Id, dto.TeamId, f.Points);
            f.LastCapturedAt = now;
            f.OwnerTeamId = dto.TeamId;
            await _db.SaveChangesAsync();

            await _admin.Clients.All.SendAsync("flagUpdated", new { gameId = g.Id, flagId = f.Id, lastCapturedAt = f.LastCapturedAt, ownerTeamId = f.OwnerTeamId });
            await _public.Clients.All.SendAsync("flagUpdated", new { gameId = g.Id, flagId = f.Id, lastCapturedAt = f.LastCapturedAt, ownerTeamId = f.OwnerTeamId });
        }

        return Ok(ev);
    }
}
