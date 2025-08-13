using Lipunryosto.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Controllers;

[ApiController]
[Route("games/{gameId:guid}/flags")]
public class FlagsForGameController : ControllerBase
{
    private readonly AppDb _db;
    public FlagsForGameController(AppDb db){ _db = db; }

    [HttpGet]
    public async Task<IActionResult> List(Guid gameId)
    {
        var game = await _db.Games.Include(g => g.Flags).FirstOrDefaultAsync(g => g.Id == gameId);
        if (game == null) return NotFound();

        // Järjestys: CreatedAt jos olemassa, muuten Id
        var flags = game.Flags
            .OrderBy(f => f.CreatedAt) // CreatedAt lisättiin malliin
            .Select(f => new {
                id = f.Id,
                name = f.Name,
                lat = f.Lat,
                lon = f.Lon,
                points = f.Points,
                color = f.Color,
                status = f.Status,
                ownerTeamId = f.OwnerTeamId,
                lastCapturedAt = f.LastCapturedAt
            })
            .ToList();

        return Ok(flags);
    }
}
