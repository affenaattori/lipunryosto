using System.Text.Json;
using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Controllers;

[ApiController]
[Route("games")]
public class GamesController : ControllerBase
{
    private readonly AppDb _db;
    public GamesController(AppDb db) { _db = db; }

    // ------------------------
    // GET /games
    // ------------------------
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var list = await _db.Games
            .Include(g => g.Teams)
            .OrderByDescending(g => g.CreatedAt)
            .ToListAsync();

        var dto = list.Select(g => new
        {
            id = g.Id,
            name = g.Name,
            status = g.Status.ToString(),
            winCondition = g.WinCondition,
            timeLimitMinutes = g.TimeLimitMinutes,
            maxPoints = g.MaxPoints,
            teams = g.Teams.Select(t => new { id = t.Id, name = t.Name, color = t.Color, score = t.Score })
        });

        return Ok(dto);
    }

    // ------------------------
    // GET /games/{id}
    // ------------------------
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var g = await _db.Games
            .Include(x => x.Teams)
            .Include(x => x.Flags)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (g == null) return NotFound();

        return Ok(new
        {
            id = g.Id,
            name = g.Name,
            status = g.Status.ToString(),
            captureTimeSeconds = g.CaptureTimeSeconds,
            timeLimitMinutes = g.TimeLimitMinutes,
            maxPoints = g.MaxPoints,
            winCondition = g.WinCondition,
            arenaName = g.ArenaName,
            startedAtUtc = g.StartedAtUtc,
            endedAtUtc = g.EndedAtUtc,
            teams = g.Teams.Select(t => new { id = t.Id, name = t.Name, color = t.Color, score = t.Score }),
            flags = g.Flags.Select(f => new
            {
                id = f.Id,
                name = f.Name,
                slug = f.Slug,
                lat = f.Lat,
                lon = f.Lon,
                points = f.Points,
                color = f.Color,
                status = f.Status,
                ownerTeamId = f.OwnerTeamId,
                lastCapturedAt = f.LastCapturedAt
            })
        });
    }

    // ------------------------
    // POST /games  (joustava luonti: camel, Pascal, {dto:{...}})
    // ------------------------
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] JsonElement body)
    {
        // hyväksy myös { dto: {...} }
        if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("dto", out var dtoElem))
        {
            body = dtoElem;
        }

        // Vaatimukset: Name, CaptureTimeSeconds, WinCondition, Teams[ { Name, Color } ]
        string name = GetString(body, "name", "Name") ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
            return ValidationProblem(new Dictionary<string, string[]> { { "Name", new[] { "Name is required." } } });

        int captureTimeSeconds = GetInt(body, "captureTimeSeconds", "CaptureTimeSeconds") ?? 60;
        string winCondition = (GetString(body, "winCondition", "WinCondition") ?? "MostPointsAtTime").Trim();
        string? arenaName = GetString(body, "arenaName", "ArenaName");

        int? timeLimitMinutes = GetInt(body, "timeLimitMinutes", "TimeLimitMinutes");
        int? maxPoints = GetInt(body, "maxPoints", "MaxPoints");

        // Teams
        var teamsElem = GetArray(body, "teams", "Teams");
        if (teamsElem is null || teamsElem.Value.GetArrayLength() < 2)
            return ValidationProblem(new Dictionary<string, string[]> { { "Teams", new[] { "At least 2 teams required." } } });

        var teamEntities = new List<Team>();
        foreach (var t in teamsElem.Value.EnumerateArray())
        {
            var tn = GetString(t, "name", "Name");
            var tc = GetString(t, "color", "Color");
            if (string.IsNullOrWhiteSpace(tn)) continue;
            teamEntities.Add(new Team { Name = tn!.Trim(), Color = tc?.Trim() });
        }
        if (teamEntities.Count < 2)
            return ValidationProblem(new Dictionary<string, string[]> { { "Teams", new[] { "At least 2 teams with names required." } } });

        // Normalisoi voittosääntö
        if (!string.Equals(winCondition, "MostPointsAtTime", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(winCondition, "AllFlagsOneTeam", StringComparison.OrdinalIgnoreCase))
        {
            winCondition = "MostPointsAtTime";
        }

        var game = new Game
        {
            Name = name.Trim(),
            Status = GameStatus.NotStarted,
            CaptureTimeSeconds = captureTimeSeconds,
            WinCondition = winCondition,
            ArenaName = arenaName,
            TimeLimitMinutes = timeLimitMinutes,
            MaxPoints = maxPoints
        };

        // Liitä joukkueet
        game.Teams = teamEntities;

        _db.Games.Add(game);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            id = game.Id,
            name = game.Name,
            status = game.Status.ToString(),
            captureTimeSeconds = game.CaptureTimeSeconds,
            timeLimitMinutes = game.TimeLimitMinutes,
            maxPoints = game.MaxPoints,
            winCondition = game.WinCondition,
            teams = game.Teams.Select(t => new { id = t.Id, name = t.Name, color = t.Color, score = t.Score })
        });
    }

    // ------------------------
    // POST /games/{id}/start
    // ------------------------
    [HttpPost("{id:guid}/start")]
    public async Task<IActionResult> Start(Guid id)
    {
        var g = await _db.Games.FirstOrDefaultAsync(x => x.Id == id);
        if (g is null) return NotFound();
        if (g.Status == GameStatus.Running) return BadRequest("Already running");
        g.Status = GameStatus.Running;
        g.StartedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, status = g.Status.ToString() });
    }

    // ------------------------
    // POST /games/{id}/pause
    // ------------------------
    [HttpPost("{id:guid}/pause")]
    public async Task<IActionResult> Pause(Guid id)
    {
        var g = await _db.Games.FirstOrDefaultAsync(x => x.Id == id);
        if (g is null) return NotFound();
        if (g.Status != GameStatus.Running) return BadRequest("Not running");
        g.Status = GameStatus.Paused;
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, status = g.Status.ToString() });
    }

    // ------------------------
    // POST /games/{id}/end
    // ------------------------
    [HttpPost("{id:guid}/end")]
    public async Task<IActionResult> End(Guid id)
    {
        var g = await _db.Games.FirstOrDefaultAsync(x => x.Id == id);
        if (g is null) return NotFound();
        g.Status = GameStatus.Ended;
        g.EndedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, status = g.Status.ToString() });
    }

    // ------------------------
    // POST /games/{id}/flags/normalize-slugs
    // Asettaa Slug:it A..J (max 10) ja Name "Lippupiste A" jne.
    // ------------------------
    [HttpPost("{id:guid}/flags/normalize-slugs")]
    public async Task<IActionResult> NormalizeSlugs(Guid id)
    {
        var flags = await _db.Flags.Where(f => f.GameId == id).OrderBy(f => f.CreatedAt).ToListAsync();
        if (flags.Count == 0) return Ok(new { ok = true, updated = 0 });

        var alphabet = "ABCDEFGHIJ"; // max 10
        int updated = 0;
        for (int i = 0; i < flags.Count && i < alphabet.Length; i++)
        {
            var slug = alphabet[i].ToString();
            if (flags[i].Slug != slug) { flags[i].Slug = slug; updated++; }
            if (string.IsNullOrWhiteSpace(flags[i].Name)) flags[i].Name = $"Lippupiste {slug}";
        }
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, updated });
    }

    // ------------------------
    // Helpers: joustava JSON-haku
    // ------------------------
    private static string? GetString(JsonElement obj, params string[] keys)
    {
        foreach (var k in keys)
        {
            if (obj.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String)
                return v.GetString();
        }
        return null;
    }

    private static int? GetInt(JsonElement obj, params string[] keys)
    {
        foreach (var k in keys)
        {
            if (obj.TryGetProperty(k, out var v))
            {
                if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n)) return n;
                if (v.ValueKind == JsonValueKind.String && int.TryParse(v.GetString(), out var m)) return m;
            }
        }
        return null;
    }

    private static JsonElement? GetArray(JsonElement obj, params string[] keys)
    {
        foreach (var k in keys)
        {
            if (obj.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.Array) return v;
        }
        return null;
    }
}
