
using Lipunryosto.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Lipunryosto.Api.Controllers;
[ApiController]
[Route("games/{gameId:guid}/teams")]
public class TeamsController : ControllerBase{
  private readonly AppDb _db;
  public TeamsController(AppDb db){ _db=db; }

  [HttpGet]
  public async Task<IActionResult> List(Guid gameId){
    var teams = await _db.Teams.Where(t=>t.GameId==gameId)
      .Select(t => new { t.Id, t.Name, t.Color, t.Score })
      .ToListAsync();
    return Ok(teams);
  }
}
