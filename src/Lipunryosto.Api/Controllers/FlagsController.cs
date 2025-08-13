using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Controllers;

[ApiController]
public class FlagsController : ControllerBase
{
    private readonly AppDb _db;
    public FlagsController(AppDb db){ _db = db; }

    // GET /games/{gameId}/flags
    [HttpGet]
    [Route("games/{gameId:guid}/flags")]
    public async Task<IActionResult> List(Guid gameId)
    {
        var game = await _db.Games.Include(g => g.Flags).FirstOrDefaultAsync(g => g.Id == gameId);
        if (game == null) return NotFound();
        var flags = game.Flags
            .OrderBy(f => f.Name)
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
            }).ToList();
        return Ok(flags);
    }

    public record CreateFlagDto(double Lat,double Lon,int Points,string? Color);
    // POST /games/{gameId}/flags
    [HttpPost]
    [Route("games/{gameId:guid}/flags")]
    public async Task<IActionResult> Create(Guid gameId,[FromBody] CreateFlagDto dto)
    {
        var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == gameId);
        if (game == null) return NotFound();

        var f = new FlagPoint {
            GameId = gameId,
            Lat = dto.Lat,
            Lon = dto.Lon,
            Points = dto.Points,
            Color = dto.Color,
            Status = "open"
        };
        _db.Flags.Add(f);
        await _db.SaveChangesAsync();

        return Ok(new { id = f.Id, name = f.Name ?? "", lat = f.Lat, lon = f.Lon, points = f.Points, color = f.Color, status = f.Status });
    }

    public record PatchFlagDto(string? Name,double? Lat,double? Lon,int? Points,string? Color,string? Status, Guid? OwnerTeamId);
    // PATCH /flags/{flagId}
    [HttpPatch]
    [Route("flags/{flagId:guid}")]
    public async Task<IActionResult> Patch(Guid flagId,[FromBody] PatchFlagDto dto)
    {
        var f = await _db.Flags.FirstOrDefaultAsync(x => x.Id == flagId);
        if (f == null) return NotFound();

        if (dto.Name != null) f.Name = string.IsNullOrWhiteSpace(dto.Name) ? null : dto.Name.Trim();
        if (dto.Lat.HasValue) f.Lat = dto.Lat.Value;
        if (dto.Lon.HasValue) f.Lon = dto.Lon.Value;
        if (dto.Points.HasValue) f.Points = dto.Points.Value;
        if (dto.Color != null) f.Color = dto.Color;
        if (dto.Status != null) f.Status = dto.Status;
        if (dto.OwnerTeamId.HasValue) f.OwnerTeamId = dto.OwnerTeamId.Value;

        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // POST /games/{gameId}/flags/normalize-names
    [HttpPost]
    [Route("games/{gameId:guid}/flags/normalize-names")]
    public async Task<IActionResult> Normalize(Guid gameId)
    {
        var flags = await _db.Flags.Where(x => x.GameId == gameId).OrderBy(x => x.CreatedAt).ToListAsync();
        // If CreatedAt missing in your model, order by Id
        if (flags.Count == 0) return Ok(new { ok = true, updated = 0 });

        int idx = 0;
        foreach (var f in flags)
        {
            var name = $"Lippupiste { (char)('A' + (idx % 26)) }";
            if (idx >= 26) name += $"{idx/26+1}"; // A1, B1 ... if >26
            f.Name = name;
            idx++;
        }
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, updated = flags.Count });
    }
}
