using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Lipunryosto.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Lipunryosto.Api.Hubs;

namespace Lipunryosto.Api.Controllers;

[ApiController]
[Route("device")]
public class DeviceController : ControllerBase
{
    private readonly AppDb _db;
    private readonly ScoringService _scoring;
    private readonly IHubContext<AdminHub> _admin;
    private readonly IHubContext<PublicHub> _public;

    public DeviceController(
        AppDb db,
        ScoringService scoring,
        IHubContext<AdminHub> admin,
        IHubContext<PublicHub> pub)
    {
        _db = db; _scoring = scoring; _admin = admin; _public = pub;
    }

    // -------------------------------------------------
    // 1) Rekisteröi laite peliin ilman OTP:tä (slugilla)
    //    Esim. body: { "gameId":"...", "flagSlug":"A", "name":"Kenttälaite A" }
    // -------------------------------------------------
    public record DeviceRegisterDto(Guid GameId, string FlagSlug, string? Name);

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] DeviceRegisterDto dto)
    {
        var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == dto.GameId);
        if (game is null) return NotFound(new { error = "game_not_found" });

        var flag = await _db.Flags.FirstOrDefaultAsync(f => f.GameId == game.Id && f.Slug == dto.FlagSlug);
        if (flag is null) return NotFound(new { error = "flag_not_found" });

        var dev = new Device
        {
            GameId = game.Id,
            AssignedFlagId = flag.Id,
            Name = dto.Name
        };
        _db.Devices.Add(dev);
        await _db.SaveChangesAsync();

        // Token on vapaaehtoinen; pidetään yhteensopivuus olemassa olevan mallin kanssa
        var token = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        dev.DeviceTokenHash = token;
        await _db.SaveChangesAsync();

        await _admin.Clients.All.SendAsync("deviceRegistered", new { deviceId = dev.Id, flagId = flag.Id, gameId = game.Id });

        return Ok(new { deviceId = dev.Id, assignedFlagId = dev.AssignedFlagId, deviceToken = token });
    }

    // -------------------------------------------------
    // 2) Laitteen heartbeat
    //    Päivittää laitteen sijainnin ja tarvittaessa myös lipun sijainnin
    // -------------------------------------------------
    public record HeartbeatDto(Guid DeviceId, double? Lat, double? Lon, double? Accuracy);

    [HttpPost("heartbeat")]
    public async Task<IActionResult> Heartbeat([FromBody] HeartbeatDto dto)
    {
        var dev = await _db.Devices.FirstOrDefaultAsync(d => d.Id == dto.DeviceId);
        if (dev is null) return NotFound(new { error = "device_not_found" });

        dev.Lat = dto.Lat;
        dev.Lon = dto.Lon;
        dev.AccuracyMeters = dto.Accuracy;
        dev.LastSeen = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        if (dev.AssignedFlagId.HasValue && dto.Lat.HasValue && dto.Lon.HasValue)
        {
            var flag = await _db.Flags.FirstOrDefaultAsync(x => x.Id == dev.AssignedFlagId.Value);
            if (flag != null)
            {
                // Jos haluat, voit tarkistaa siirtymän ja päivittää vain jos > X m:
                // var moved = GeoHelper.Haversine(flag.Lat, flag.Lon, dto.Lat.Value, dto.Lon.Value);
                // if (moved > 3.0) { ... }
                flag.Lat = dto.Lat.Value;
                flag.Lon = dto.Lon.Value;
                await _db.SaveChangesAsync();

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

    // -------------------------------------------------
    // 3) Valloitus (kahden vaiheen malli: start -> confirm)
    // -------------------------------------------------
    public record CaptureDto(Guid TeamId, string Phase, double? Lat, double? Lon, double? Accuracy);

    [HttpPost("flags/{flagId:guid}/capture")]
    public async Task<IActionResult> Capture(Guid flagId, [FromBody] CaptureDto dto)
    {
        var flag = await _db.Flags.FirstOrDefaultAsync(x => x.Id == flagId);
        if (flag is null) return NotFound();

        var game = await _db.Games.FirstAsync(x => x.Id == flag.GameId);
        if (game.Status != GameStatus.Running) return BadRequest("Game not live");

        var now = DateTimeOffset.UtcNow;

        // Talleta tapahtuma (timeline)
        var ev = new CaptureEvent
        {
            GameId = game.Id,
            FlagId = flag.Id,
            TeamId = dto.TeamId,
            Phase = dto.Phase,
            Lat = dto.Lat,
            Lon = dto.Lon,
            Accuracy = dto.Accuracy,
            Timestamp = now
        };
        _db.Events.Add(ev);
        await _db.SaveChangesAsync();

        await _admin.Clients.All.SendAsync("eventCreated", new { gameId = game.Id, evId = ev.Id, phase = ev.Phase, flagId = flag.Id, teamId = ev.TeamId, ts = ev.Timestamp });
        await _public.Clients.All.SendAsync("eventCreated", new { gameId = game.Id, evId = ev.Id, phase = ev.Phase, flagId = flag.Id, teamId = ev.TeamId, ts = ev.Timestamp });

        if (string.Equals(dto.Phase, "confirm", StringComparison.OrdinalIgnoreCase))
        {
            // Etsi uusin "start" samalle lipulle & tiimille
            var start = await _db.Events
                .Where(x => x.GameId == game.Id && x.FlagId == flag.Id && x.TeamId == dto.TeamId && x.Phase == "start")
                .OrderByDescending(x => x.Timestamp)
                .FirstOrDefaultAsync();
            if (start is null) return BadRequest("Start not found");

            var elapsed = now - start.Timestamp;
            // 10 s armovara ennen CaptureTimeSeconds-rajaa
            if (elapsed.TotalSeconds + 10 < game.CaptureTimeSeconds)
                return BadRequest("Confirm too early");

            // (valinnainen) geo-fence
            if (dto.Lat.HasValue && dto.Lon.HasValue && flag.Lat != 0 && flag.Lon != 0)
            {
                var dist = GeoHelper.Haversine(flag.Lat, flag.Lon, dto.Lat.Value, dto.Lon.Value);
                if (dist > 50) return BadRequest("Out of geofence"); // 50 m oletus
            }

            // Pisteet + omistajuus
            await _scoring.AwardAsync(game.Id, dto.TeamId, flag.Points);
            flag.LastCapturedAt = now;
            flag.OwnerTeamId = dto.TeamId;
            await _db.SaveChangesAsync();

            await _admin.Clients.All.SendAsync("flagUpdated", new { gameId = game.Id, flagId = flag.Id, lastCapturedAt = flag.LastCapturedAt, ownerTeamId = flag.OwnerTeamId });
            await _public.Clients.All.SendAsync("flagUpdated", new { gameId = game.Id, flagId = flag.Id, lastCapturedAt = flag.LastCapturedAt, ownerTeamId = flag.OwnerTeamId });
        }

        return Ok(ev);
    }

    // -------------------------------------------------
    // 4) Parita laite tiettyyn lippuun (administa helppo käyttää)
    // -------------------------------------------------
    [HttpPost("{deviceId:guid}/assign-flag/{flagId:guid}")]
    public async Task<IActionResult> AssignFlag(Guid deviceId, Guid flagId)
    {
        var dev = await _db.Devices.FirstOrDefaultAsync(d => d.Id == deviceId);
        if (dev == null) return NotFound(new { error = "device_not_found" });

        var flag = await _db.Flags.FirstOrDefaultAsync(f => f.Id == flagId);
        if (flag == null) return NotFound(new { error = "flag_not_found" });

        if (!dev.GameId.HasValue) dev.GameId = flag.GameId;
        else if (dev.GameId.Value != flag.GameId)
            return Conflict(new { error = "different_game", deviceGameId = dev.GameId, flagGameId = flag.GameId });

        dev.AssignedFlagId = flag.Id;
        await _db.SaveChangesAsync();

        await _admin.Clients.All.SendAsync("deviceAssigned", new { deviceId = dev.Id, flagId = flag.Id, gameId = flag.GameId });
        await _public.Clients.All.SendAsync("deviceAssigned", new { deviceId = dev.Id, flagId = flag.Id, gameId = flag.GameId });

        return Ok(new { ok = true, deviceId = dev.Id, assignedFlagId = dev.AssignedFlagId, gameId = dev.GameId });
    }

    // -------------------------------------------------
    // 5) Irrota laitteen paritus lipusta
    // -------------------------------------------------
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
}
