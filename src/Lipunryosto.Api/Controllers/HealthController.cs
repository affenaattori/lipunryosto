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
        private readonly IWebHostEnvironment _env;

        public HealthController(AppDb db, ILogger<HealthController> logger, IWebHostEnvironment env)
        {
            _db = db;
            _logger = logger;
            _env = env;
        }

        // --------------------------------------------------------------------
        // GET /__diag/db   → DB-provideri + kirjoitus/luku -testi Games-tauluun
        // --------------------------------------------------------------------
        [HttpGet("db")]
        [ResponseCache(Location = ResponseCacheLocation.None, NoStore = true)]
        public async Task<IActionResult> CheckDb()
        {
            var provider = _db.Database.ProviderName ?? "unknown";

            try
            {
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

        // --------------------------------------------------------------------
        // GET /__diag/env  → Turvallinen ympäristökuvaus (maskatut arvot)
        // --------------------------------------------------------------------
        [HttpGet("env")]
        [ResponseCache(Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult GetEnv()
        {
            // Näytetään vain "turvalliset" tai olennaiset avaimet ja maskataan arvot.
            // Voit lisätä avaimia listaan tarpeen mukaan.
            string[] safeKeys = new[]
            {
                "ASPNETCORE_ENVIRONMENT",
                "DOTNET_VERSION",
                "WEBSITE_SITE_NAME",
                "WEBSITE_INSTANCE_ID",
                "REGION_NAME",
                "USE_INMEMORY",
                "SQL_CONNECTION",           // jos käytät omaa nimeä
                "ConnectionStrings__Default",
                "AZURE_SUBSCRIPTION_ID",
                "AZURE_TENANT_ID",
                "AZURE_CLIENT_ID"
            };

            var envVars = new Dictionary<string, object?>();
            foreach (var key in safeKeys)
            {
                var val = Environment.GetEnvironmentVariable(key);
                envVars[key] = Mask(val);
            }

            // Kerrotaan myös prosessin/hostin yleisiä, ei-salaisia tietoja
            var info = new
            {
                ok = true,
                environment = _env.EnvironmentName,
                machineName = Environment.MachineName,
                process = new
                {
                    name = AppDomain.CurrentDomain.FriendlyName,
                    framework = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
                    runtime = System.Runtime.InteropServices.RuntimeInformation.RuntimeIdentifier,
                    os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
                    processId = Environment.ProcessId
                },
                time = new
                {
                    utc = DateTimeOffset.UtcNow,
                    local = DateTimeOffset.Now
                },
                vars = envVars
            };

            return Ok(info);
        }

        // Arvojen maskaus: näyttää vain pituuden ja ensimmäiset 3 merkkiä, jos turvallista
        private static object? Mask(string? value)
        {
            if (string.IsNullOrEmpty(value)) return null;
            // jos arvo näyttää ei-salaiselta (esim. "Development", "true/false"), näytä sellaisenaan
            var lower = value.ToLowerInvariant();
            if (lower is "development" or "staging" or "production" or "true" or "false") return value;

            // maskaa muut
            var shown = value.Length <= 6 ? value[..1] : value[..3];
            return $"{shown}*** (len={value.Length})";
        }
    }
}
