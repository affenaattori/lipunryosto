using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;

namespace Lipunryosto.Api.Controllers
{
    [ApiController]
    [Route("__diag")]
    public class HealthController : ControllerBase
    {
        private readonly AppDb _db;
        private readonly ILogger<HealthController> _logger;

        public HealthController(AppDb db, ILogger<HealthController> logger)
        {
            _db = db;
            _logger = logger;
        }

        [HttpGet("db")]
        public async Task<IActionResult> CheckDb()
        {
            var provider = _db.Database.ProviderName ?? "unknown";

            try
            {
                // testiluonti
                var testGame = new Game
                {
                    Name = "diag-test",
                    Status = GameStatus.NotStarted,
                    CaptureTimeSeconds = 60,
                    WinCondition = "MostPointsAtTime",
                    CreatedAt = DateTimeOffset.UtcNow,
                    Teams = new List<Team> {
                        new Team { Name = "DiagTeam", Color = "#000000", Score = 0 }
                    }
                };

                _db.Games.Add(testGame);
                await _db.SaveChangesAsync();

                // testihaku
                var count = await _db.Games.CountAsync();

                return Ok(new
                {
                    ok = true,
                    provider,
                    gamesCount = count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DB health check failed");
                return StatusCode(500, new
                {
                    ok = false,
                    provider,
                    error = ex.Message
                });
            }
        }
    }
}
