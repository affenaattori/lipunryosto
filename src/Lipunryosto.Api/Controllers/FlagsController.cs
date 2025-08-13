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

    public record CreateFlagDto(double Lat,double Lon,int Points,string? Color);

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

    // Nimeä liput peräkkäin A, B, C ...; ei CreatedAt-riippuvuutta
    [HttpPost]
    [Route("games/{gameId:guid}/flags/normalize-names")]
    public async Task<IActionResult> Normalize(Guid gameId)
    {
        var flags = await _db.Flags.Where(x => x.GameId == gameId).OrderBy(x => x.Id).ToListAsync();
        if (flags.Count == 0) return Ok(new { ok = true, updated = 0 });

        for (int idx = 0; idx < flags.Count; idx++)
        {
            var f = flags[idx];
            var baseChar = (char)('A' + (idx % 26));
            var name = $"Lippupiste {baseChar}";
            if (idx >= 26) name += $"{(idx/26)+1}";
            f.Name = name;
        }
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, updated = flags.Count });
    }
}
