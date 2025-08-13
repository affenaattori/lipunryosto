using System.Text.Json;
using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Controllers;

[ApiController]
[Route("")]
public class FlagsController : ControllerBase
{
    private readonly AppDb _db;
    public FlagsController(AppDb db) { _db = db; }

    // ---------------------------------------------
    // GET /games/{gameId}/flags  -> listaa liput
    // ---------------------------------------------
    [HttpGet("games/{gameId:guid}/flags")]
    public async Task<IActionResult> GetForGame(Guid gameId)
    {
        var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == gameId);
        if (game is null) return NotFound(new { error = "game_not_found" });

        var flags = await _db.Flags
            .Where(f => f.GameId == gameId)
            .OrderBy(f => f.CreatedAt)
            .ToListAsync();

        var dto = flags.Select(f => new
        {
            id = f.Id,
            gameId = f.GameId,
            name = f.Name,
            slug = f.Slug,
            lat = f.Lat,
            lon = f.Lon,
            points = f.Points,
            color = f.Color,
            status = f.Status,
            ownerTeamId = f.OwnerTeamId,
            lastCapturedAt = f.LastCapturedAt,
            createdAt = f.CreatedAt
        });

        return Ok(dto);
    }

    // ---------------------------------------------
    // POST /games/{gameId}/flags  -> lisää lippu
    // Hyväksyy myös { dto:{...} }
    // ---------------------------------------------
    [HttpPost("games/{gameId:guid}/flags")]
    public async Task<IActionResult> Create(Guid gameId, [FromBody] JsonElement body)
    {
        var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == gameId);
        if (game is null) return NotFound(new { error = "game_not_found" });

        if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("dto", out var dtoElem))
            body = dtoElem;

        string? name  = GetString(body, "name", "Name");
        string? slug  = GetString(body, "slug", "Slug");
        string? color = GetString(body, "color", "Color");
        string? status= GetString(body, "status", "Status");

        int points    = GetInt(body, "points", "Points") ?? 10;
        double lat    = GetDouble(body, "lat", "Lat") ?? 0;
        double lon    = GetDouble(body, "lon", "Lon") ?? 0;

        if (string.IsNullOrWhiteSpace(name))
        {
            var errors = new Dictionary<string,string[]> { { "name", new[]{ "Name is required." } } };
            return BadRequest(new { errors });
        }

        var flag = new FlagPoint
        {
            GameId = game.Id,
            Name   = name.Trim(),
            Slug   = string.IsNullOrWhiteSpace(slug) ? null : slug.Trim(),
            Points = points,
            Lat    = lat,
            Lon    = lon,
            Color  = string.IsNullOrWhiteSpace(color) ? null : color.Trim(),
            Status = string.IsNullOrWhiteSpace(status) ? "open" : status.Trim(),
        };

        _db.Flags.Add(flag);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            id = flag.Id,
            gameId = flag.GameId,
            name = flag.Name,
            slug = flag.Slug,
            lat = flag.Lat,
            lon = flag.Lon,
            points = flag.Points,
            color = flag.Color,
            status = flag.Status,
            ownerTeamId = flag.OwnerTeamId,
            lastCapturedAt = flag.LastCapturedAt,
            createdAt = flag.CreatedAt
        });
    }

    // ---------------------------------------------
    // GET /flags/{id}  -> yksittäinen lippu
    // ---------------------------------------------
    [HttpGet("flags/{id:guid}")]
    public async Task<IActionResult> GetOne(Guid id)
    {
        var f = await _db.Flags.FirstOrDefaultAsync(x => x.Id == id);
        if (f is null) return NotFound(new { error = "flag_not_found" });

        return Ok(new
        {
            id = f.Id,
            gameId = f.GameId,
            name = f.Name,
            slug = f.Slug,
            lat = f.Lat,
            lon = f.Lon,
            points = f.Points,
            color = f.Color,
            status = f.Status,
            ownerTeamId = f.OwnerTeamId,
            lastCapturedAt = f.LastCapturedAt,
            createdAt = f.CreatedAt
        });
    }

    // ---------------------------------------------
    // PUT /flags/{id}  -> osittainen päivitys
    // Hyväksyy sekä camel että Pascal sekä { dto:{...} }
    // ---------------------------------------------
    [HttpPut("flags/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] JsonElement body)
    {
        var f = await _db.Flags.FirstOrDefaultAsync(x => x.Id == id);
        if (f is null) return NotFound(new { error = "flag_not_found" });

        if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("dto", out var dtoElem))
            body = dtoElem;

        // Osittaiset päivitykset – jos arvo löytyy, päivitetään.
        var name   = GetString(body, "name", "Name");
        var slug   = GetString(body, "slug", "Slug");
        var color  = GetString(body, "color", "Color");
        var status = GetString(body, "status", "Status");

        var points = GetInt(body, "points", "Points");
        var lat    = GetDouble(body, "lat", "Lat");
        var lon    = GetDouble(body, "lon", "Lon");
        var owner  = GetGuid(body, "ownerTeamId", "OwnerTeamId");

        if (name is not null)   f.Name = name.Trim();
        if (slug is not null)   f.Slug = string.IsNullOrWhiteSpace(slug) ? null : slug.Trim();
        if (color is not null)  f.Color = string.IsNullOrWhiteSpace(color) ? null : color.Trim();
        if (status is not null) f.Status = string.IsNullOrWhiteSpace(status) ? null : status.Trim();

        if (points.HasValue) f.Points = points.Value;
        if (lat.HasValue)    f.Lat = lat.Value;
        if (lon.HasValue)    f.Lon = lon.Value;
        if (owner.HasValue)  f.OwnerTeamId = owner.Value;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            id = f.Id,
            gameId = f.GameId,
            name = f.Name,
            slug = f.Slug,
            lat = f.Lat,
            lon = f.Lon,
            points = f.Points,
            color = f.Color,
            status = f.Status,
            ownerTeamId = f.OwnerTeamId,
            lastCapturedAt = f.LastCapturedAt,
            createdAt = f.CreatedAt
        });
    }

    // ---------------------------------------------
    // DELETE /flags/{id}
    // ---------------------------------------------
    [HttpDelete("flags/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var f = await _db.Flags.FirstOrDefaultAsync(x => x.Id == id);
        if (f is null) return NotFound(new { error = "flag_not_found" });

        _db.Flags.Remove(f);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // =======================
    // JSON helperit
    // =======================
    private static string? GetString(JsonElement obj, params string[] keys)
    {
        foreach (var k in keys)
            if (obj.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String)
                return v.GetString();
        return null;
    }

    private static int? GetInt(JsonElement obj, params string[] keys)
    {
        foreach (var k in keys)
        {
            if (!obj.TryGetProperty(k, out var v)) continue;
            if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n)) return n;
            if (v.ValueKind == JsonValueKind.String && int.TryParse(v.GetString(), out var s)) return s;
        }
        return null;
    }

    private static double? GetDouble(JsonElement obj, params string[] keys)
    {
        foreach (var k in keys)
        {
            if (!obj.TryGetProperty(k, out var v)) continue;
            if (v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var n)) return n;
            if (v.ValueKind == JsonValueKind.String && double.TryParse(v.GetString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var d)) return d;
        }
        return null;
    }

    private static Guid? GetGuid(JsonElement obj, params string[] keys)
    {
        foreach (var k in keys)
        {
            if (!obj.TryGetProperty(k, out var v)) continue;
            if (v.ValueKind == JsonValueKind.String && Guid.TryParse(v.GetString(), out var g)) return g;
        }
        return null;
    }
}
