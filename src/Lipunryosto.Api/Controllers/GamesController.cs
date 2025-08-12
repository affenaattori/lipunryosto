using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Controllers
{
    [ApiController]
    [Route("games")]
    public class GamesController : ControllerBase
    {
        private readonly AppDb _db;
        public GamesController(AppDb db) { _db = db; }

        public record TeamDto(string Name, string? Color);
        public record CreateGameDto(
            string Name,
            int CaptureTimeSeconds,
            string WinCondition,       // "MostPointsAtTime" | "AllFlagsOneTeam"
            int? TimeLimitMinutes,
            int? MaxPoints,
            string? ArenaName,
            List<TeamDto> Teams
        );

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateGameDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("Name is required.");
            if (dto.CaptureTimeSeconds <= 0)
                return BadRequest("CaptureTimeSeconds must be > 0.");
            if (dto.Teams is null || dto.Teams.Count < 2)
                return BadRequest("At least 2 teams required.");

            var game = new Game
            {
                Name = dto.Name.Trim(),
                CaptureTimeSeconds = dto.CaptureTimeSeconds,
                WinCondition = string.IsNullOrWhiteSpace(dto.WinCondition) ? "MostPointsAtTime" : dto.WinCondition.Trim(),
                TimeLimitMinutes = dto.TimeLimitMinutes,
                MaxPoints = dto.MaxPoints,
                ArenaName = string.IsNullOrWhiteSpace(dto.ArenaName) ? null : dto.ArenaName!.Trim(),
            };

            foreach (var t in dto.Teams)
            {
                if (string.IsNullOrWhiteSpace(t.Name)) continue;
                game.Teams.Add(new Team { Name = t.Name.Trim(), Color = string.IsNullOrWhiteSpace(t.Color)? null : t.Color.Trim() });
            }

            if (game.Teams.Count < 2) return BadRequest("At least 2 named teams required.");

            _db.Games.Add(game);
            await _db.SaveChangesAsync();

            return Ok(new {
                game.Id,
                game.Name,
                game.CaptureTimeSeconds,
                game.WinCondition,
                game.TimeLimitMinutes,
                game.MaxPoints,
                game.ArenaName,
                Teams = game.Teams.Select(t => new { t.Id, t.Name, t.Color }).ToList()
            });
        }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var list = await _db.Games
                .OrderByDescending(g => g.CreatedAt)
                .Include(g => g.Teams)
                .Select(g => new {
                    g.Id,
                    g.Name,
                    g.CaptureTimeSeconds,
                    g.WinCondition,
                    g.TimeLimitMinutes,
                    g.MaxPoints,
                    g.ArenaName,
                    g.IsArchived,
                    Teams = g.Teams.Select(t => new { t.Id, t.Name, t.Color }).ToList()
                })
                .ToListAsync();

            return Ok(list);
        }

        public record PatchGameDto(
            string? Name,
            int? CaptureTimeSeconds,
            string? WinCondition,
            int? TimeLimitMinutes,
            int? MaxPoints,
            string? ArenaName,
            bool? IsArchived
        );

        [HttpPatch("{id:guid}")]
        public async Task<IActionResult> Patch(Guid id, [FromBody] PatchGameDto dto)
        {
            var g = await _db.Games.FirstOrDefaultAsync(x => x.Id == id);
            if (g == null) return NotFound();

            if (!string.IsNullOrWhiteSpace(dto.Name)) g.Name = dto.Name.Trim();
            if (dto.CaptureTimeSeconds.HasValue && dto.CaptureTimeSeconds.Value > 0) g.CaptureTimeSeconds = dto.CaptureTimeSeconds.Value;
            if (!string.IsNullOrWhiteSpace(dto.WinCondition)) g.WinCondition = dto.WinCondition.Trim();
            if (dto.TimeLimitMinutes.HasValue) g.TimeLimitMinutes = dto.TimeLimitMinutes.Value;
            if (dto.MaxPoints.HasValue) g.MaxPoints = dto.MaxPoints.Value;
            if (dto.ArenaName != null) g.ArenaName = string.IsNullOrWhiteSpace(dto.ArenaName) ? null : dto.ArenaName.Trim();
            if (dto.IsArchived.HasValue) g.IsArchived = dto.IsArchived.Value;

            await _db.SaveChangesAsync();
            return Ok(new { ok = true });
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> Get(Guid id)
        {
            var g = await _db.Games
                .Include(x => x.Teams)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (g == null) return NotFound();

            return Ok(new {
                g.Id, g.Name, g.CaptureTimeSeconds, g.WinCondition, g.TimeLimitMinutes, g.MaxPoints, g.ArenaName,
                Teams = g.Teams.Select(t => new { t.Id, t.Name, t.Color }).ToList()
            });
        }
    }
}
