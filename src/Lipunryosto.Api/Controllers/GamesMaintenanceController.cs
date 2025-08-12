using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Lipunryosto.Api.Controllers
{
    [ApiController]
    [Route("games")]
    public class GamesMaintenanceController : ControllerBase
    {
        private readonly AppDb _db;
        private readonly IConfiguration _cfg;
        public GamesMaintenanceController(AppDb db, IConfiguration cfg){ _db = db; _cfg = cfg; }

        // --- Archive / Unarchive / Delete ---
        [HttpPost("{id:guid}/archive")]
        public async Task<IActionResult> Archive(Guid id)
        {
            var g = await _db.Games.FindAsync(id);
            if (g == null) return NotFound();
            g.IsArchived = true;
            await _db.SaveChangesAsync();
            return Ok(new { ok = true });
        }

        [HttpPost("{id:guid}/unarchive")]
        public async Task<IActionResult> Unarchive(Guid id)
        {
            var g = await _db.Games.FindAsync(id);
            if (g == null) return NotFound();
            g.IsArchived = false;
            await _db.SaveChangesAsync();
            return Ok(new { ok = true });
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var g = await _db.Games.Include(x => x.Teams).FirstOrDefaultAsync(x => x.Id == id);
            if (g == null) return NotFound();
            _db.Games.Remove(g);
            await _db.SaveChangesAsync();
            return Ok(new { ok = true });
        }

        // --- Replace teams for a game ---
        public record TeamUpsertDto(string Name, string? Color);

        [HttpPut("{id:guid}/teams")]
        public async Task<IActionResult> ReplaceTeams(Guid id, [FromBody] List<TeamUpsertDto> teams)
        {
            var g = await _db.Games.Include(x => x.Teams).FirstOrDefaultAsync(x => x.Id == id);
            if (g == null) return NotFound();
            if (teams == null || teams.Count < 2) return BadRequest("At least 2 teams required.");

            // remove existing
            _db.Teams.RemoveRange(g.Teams);

            // add new
            foreach (var t in teams)
            {
                if (string.IsNullOrWhiteSpace(t.Name)) continue;
                g.Teams.Add(new Team { Name = t.Name.Trim(), Color = string.IsNullOrWhiteSpace(t.Color) ? null : t.Color!.Trim() });
            }
            if (g.Teams.Count < 2) return BadRequest("At least 2 named teams required.");

            await _db.SaveChangesAsync();
            return Ok(new { ok = true, teams = g.Teams.Select(t => new { t.Id, t.Name, t.Color }).ToList() });
        }

        // --- Generate public token & PWA URL ---
        [HttpPost("{id:guid}/generate-public-token")]
        public async Task<IActionResult> GeneratePublicToken(Guid id, [FromQuery] bool force = false)
        {
            var g = await _db.Games.FirstOrDefaultAsync(x => x.Id == id);
            if (g == null) return NotFound();

            if (force || string.IsNullOrWhiteSpace(g.PublicUrlToken))
            {
                g.PublicUrlToken = Convert.ToBase64String(Guid.NewGuid().ToByteArray())
                    .Replace("+","").Replace("/","").Replace("=","").Substring(0,10);
                await _db.SaveChangesAsync();
            }

            var pwaBase = _cfg["Frontend:PwaBaseUrl"];
            var apiBase = _cfg["Frontend:ApiBaseUrl"];

            string? pwaUrl = null;
            if (!string.IsNullOrWhiteSpace(pwaBase) && !string.IsNullOrWhiteSpace(apiBase))
            {
                pwaUrl = $"{pwaBase.TrimEnd('/')}/?api={Uri.EscapeDataString(apiBase.TrimEnd('/'))}&token={Uri.EscapeDataString(g.PublicUrlToken!)}";
            }

            return Ok(new {
                gameId = g.Id,
                token = g.PublicUrlToken,
                pwaUrl
            });
        }
    }
}
