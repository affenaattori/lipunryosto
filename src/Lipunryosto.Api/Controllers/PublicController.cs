
using Lipunryosto.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Lipunryosto.Api.Controllers;
[ApiController]
[Route("public")]
public class PublicController : ControllerBase{
  private readonly AppDb _db; public PublicController(AppDb db){_db=db;}
  [HttpGet("games/{token}")] public async Task<IActionResult> Get(string token){
    var g=await _db.Games.Include(x=>x.TeamList).Include(x=>x.FlagPoints).FirstOrDefaultAsync(x=>x.PublicUrlToken==token);
    if(g is null) return NotFound();
    return Ok(new { game=new{ g.Id,g.Name,g.Status,g.StartTime,g.EndTime,g.MaxPoints,g.MaxDurationMinutes,g.CaptureTimeSeconds,g.CaptureMode,g.AreaGeoJson }, teams=g.TeamList.Select(t=>new{ t.Id,t.Name,t.Color,t.Score }), flags=g.FlagPoints.Select(f=>new{ f.Id,f.Name,f.Lat,f.Lon,f.Color,f.Points,f.Status }) });
  }
}
