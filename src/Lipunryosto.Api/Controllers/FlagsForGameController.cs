using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Controllers
{
    [ApiController]
    [Route("games/{gameId:guid}/flags")]
    public class FlagsForGameController : ControllerBase
    {
        private readonly AppDb _db;
        public FlagsForGameController(AppDb db){ _db = db; }

        // 1 -> A, 2 -> B, ..., 26 -> Z, 27 -> AA, 28 -> AB, ...
        private static string IndexToLabel(int index)
        {
            var i = index;
            var s = "";
            while (i > 0)
            {
                i--; // zero-based
                s = (char)('A' + (i % 26)) + s;
                i /= 26;
            }
            return s;
        }

        private async Task<string> NextFlagNameAsync(Guid gameId)
        {
            var count = await _db.Flags.CountAsync(f => f.GameId == gameId);
            var label = IndexToLabel(count + 1);
            return $"Lippupiste {label}";
        }

        public record CreateFlagDto(double Lat, double Lon, int Points = 10, string? Color = null);

        // Luo lippu automaattisesti nimetettynä (Lippupiste A, B, ...)
        [HttpPost]
        public async Task<IActionResult> Create(Guid gameId, [FromBody] CreateFlagDto dto)
        {
            var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == gameId);
            if (game is null) return NotFound("Game not found");

            var name = await NextFlagNameAsync(gameId);

            var f = new FlagPoint {
                GameId = gameId,
                Name = name,
                Lat = dto.Lat,
                Lon = dto.Lon,
                Points = dto.Points,
                Color = dto.Color ?? "blue",
                Status = "open",
                CreatedAt = DateTimeOffset.UtcNow
            };

            _db.Flags.Add(f);
            await _db.SaveChangesAsync();
            return Ok(new { f.Id, f.Name, f.Lat, f.Lon, f.Points, f.Color, f.Status });
        }

        // Listaa pelin liput (admin-käyttöön)
        [HttpGet]
        public async Task<IActionResult> List(Guid gameId)
        {
            var flags = await _db.Flags
                .Where(x => x.GameId == gameId)
                .OrderBy(x => x.CreatedAt)
                .Select(f => new {
                    f.Id, f.Name, f.Lat, f.Lon, f.Points, f.Color, f.Status, f.OwnerTeamId, f.CreatedAt
                })
                .ToListAsync();

            return Ok(flags);
        }

        // Normalisoi nimet nykyiseen järjestykseen (A, B, C, ...)
        [HttpPost("normalize-names")]
        public async Task<IActionResult> Normalize(Guid gameId)
        {
            var flags = await _db.Flags
                .Where(x => x.GameId == gameId)
                .OrderBy(x => x.CreatedAt)
                .ToListAsync();

            for (int i = 0; i < flags.Count; i++)
            {
                var want = $"Lippupiste {IndexToLabel(i+1)}";
                if (string.IsNullOrWhiteSpace(flags[i].Name) || flags[i].Name.StartsWith("Lippupiste "))
                    flags[i].Name = want;
            }
            await _db.SaveChangesAsync();
            return Ok(new { updated = flags.Count });
        }
    }
}
