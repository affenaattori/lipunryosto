using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Services
{
    public class ScoringService
    {
        private readonly AppDb _db;
        public ScoringService(AppDb db){ _db = db; }

        public async Task AwardAsync(Guid gameId, Guid teamId, int points)
        {
            var game = await _db.Games
                .Include(g => g.Teams)
                .Include(g => g.Flags)
                .FirstOrDefaultAsync(g => g.Id == gameId);
            if (game == null) return;

            var team = game.Teams.FirstOrDefault(t => t.Id == teamId);
            if (team == null) return;

            team.Score += points;

            // MaxPoints-voitto
            if (game.MaxPoints.HasValue && team.Score >= game.MaxPoints.Value)
            {
                game.Status = GameStatus.Ended; // EI merkkijonoa
            }

            // AllFlagsOneTeam-voitto
            if (string.Equals(game.WinCondition, "AllFlagsOneTeam", StringComparison.OrdinalIgnoreCase))
            {
                // Flags on ICollection -> Count property löytyy, mutta varmistetaan Any() & All()
                if (game.Flags != null && game.Flags.Count > 0 && game.Flags.All(f => f.OwnerTeamId == teamId))
                {
                    game.Status = GameStatus.Ended;
                }
            }

            await _db.SaveChangesAsync();
        }
    }
}
