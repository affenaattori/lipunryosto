using Lipunryosto.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Controllers;

[ApiController]
[Route("public")]
public class PublicController : ControllerBase
{
    private readonly AppDb _db;
    public PublicController(AppDb db){ _db = db; }

    // GET /public/games/{id}
    [HttpGet("games/{id:guid}")]
    public async Task<IActionResult> GetGame(Guid id)
    {
        var g = await _db.Games
            .Include(x => x.Teams)
            .Include(x => x.Flags)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (g == null) return NotFound();

        return Ok(new {
            id = g.Id,
            name = g.Name,
            status = g.Status.ToString(),
            captureTimeSeconds = g.CaptureTimeSeconds,
            timeLimitMinutes = g.TimeLimitMinutes,
            maxPoints = g.MaxPoints,
            winCondition = g.WinCondition,
            teams = g.Teams.Select(t => new { id = t.Id, name = t.Name, color = t.Color, score = t.Score }),
            flags = g.Flags.Select(f => new { id = f.Id, name = f.Name, lat = f.Lat, lon = f.Lon, points = f.Points, color = f.Color, status = f.Status, ownerTeamId = f.OwnerTeamId, lastCapturedAt = f.LastCapturedAt })
        });
    }
}
