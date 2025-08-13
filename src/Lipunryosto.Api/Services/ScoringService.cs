using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Services
{
    public class ScoringService
    {
        private readonly AppDb _db;
        public ScoringService(AppDb db){ _db = db; }

        /// <summary>
        /// Lisää pisteet tiimille ja tarkistaa yksinkertaiset voittoehtot.
        /// </summary>
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

            // Tarkista MaxPoints
            if (game.MaxPoints.HasValue && team.Score >= game.MaxPoints.Value)
            {
                game.Status = GameStatus.Ended;
            }

            // Tarkista AllFlagsOneTeam
            if (string.Equals(game.WinCondition, "AllFlagsOneTeam", StringComparison.OrdinalIgnoreCase))
            {
                if (game.Flags.Count > 0 && game.Flags.All(f => f.OwnerTeamId == teamId))
                {
                    game.Status = GameStatus.Ended;
                }
            }

            await _db.SaveChangesAsync();
        }
    }
}
