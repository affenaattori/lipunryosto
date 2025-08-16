using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Controllers;

[ApiController]
[Route("games/{gameId:guid}/area")]
public class GameAreaController : ControllerBase
{
    private readonly AppDb _db;
    public GameAreaController(AppDb db) { _db = db; }

    // GET games/{id}/area → palauttaa GeoJSON Feature (Polygon)
    [HttpGet]
    public async Task<IActionResult> Get(Guid gameId)
    {
        var a = await _db.Areas.AsNoTracking().FirstOrDefaultAsync(x => x.GameId == gameId);
        if (a is null) return NotFound();
        return Content(a.GeoJson, "application/json");
    }

    // PUT games/{id}/area → korvaa/luo
    [HttpPut]
    public async Task<IActionResult> Put(Guid gameId, [FromBody] object geojson)
    {
        // talletetaan sellaisenaan (front tuottaa Feature/Polygonin oikein)
        var raw = geojson?.ToString() ?? "{}";
        var a = await _db.Areas.FirstOrDefaultAsync(x => x.GameId == gameId);
        if (a is null)
        {
            a = new GameArea { GameId = gameId, GeoJson = raw, UpdatedAt = DateTimeOffset.UtcNow };
            _db.Areas.Add(a);
        }
        else
        {
            a.GeoJson = raw;
            a.UpdatedAt = DateTimeOffset.UtcNow;
        }
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, updatedAt = a.UpdatedAt });
    }
}
