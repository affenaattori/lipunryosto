
using Lipunryosto.Api.Data;
using Lipunryosto.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
namespace Lipunryosto.Api.Services;
public class ScoringService {
  private readonly AppDb _db; private readonly IHubContext<AdminHub> _admin; private readonly IHubContext<PublicHub> _public;
  public ScoringService(AppDb db, IHubContext<AdminHub> admin, IHubContext<PublicHub> pub) { _db=db; _admin=admin; _public=pub; }
  public async Task<int> AwardAsync(Guid gameId, Guid teamId, int points){
    var team = await _db.Teams.FirstAsync(t=>t.Id==teamId && t.GameId==gameId);
    team.Score += points; await _db.SaveChangesAsync();
    var payload = new { teamId = team.Id, score = team.Score };
    await _admin.Clients.All.SendAsync("scoreUpdated", new { gameId, team = payload });
    await _public.Clients.All.SendAsync("scoreUpdated", new { gameId, team = payload });
    var game = await _db.Games.FirstAsync(g=>g.Id==gameId);
    if (team.Score >= game.MaxPoints) {
      game.Status = "finished"; await _db.SaveChangesAsync();
      await _admin.Clients.All.SendAsync("statusChanged", new { gameId, status = game.Status });
      await _public.Clients.All.SendAsync("statusChanged", new { gameId, status = game.Status });
    }
    return team.Score;
  }
}
