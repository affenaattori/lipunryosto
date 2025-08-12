
using Lipunryosto.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Lipunryosto.Api.Controllers;
[ApiController]
[Route("[controller]")]
public class FlagsController : ControllerBase{
  private readonly AppDb _db; public FlagsController(AppDb db){_db=db;}
  [HttpPatch("{flagId:guid}")]
  public async Task<IActionResult> Patch(Guid flagId,[FromBody] Dictionary<string,object> p){
    var f=await _db.Flags.FirstOrDefaultAsync(x=>x.Id==flagId); if(f is null) return NotFound();
    foreach(var kv in p){
      switch(kv.Key){
        case "Color": f.Color = kv.Value?.ToString() ?? f.Color; break;
        case "Points": f.Points = Convert.ToInt32(kv.Value); break;
        case "Status": f.Status = kv.Value?.ToString() ?? f.Status; break;
        case "Lat": f.Lat = Convert.ToDouble(kv.Value); break;
        case "Lon": f.Lon = Convert.ToDouble(kv.Value); break;
      }
    }
    await _db.SaveChangesAsync(); return Ok(f);
  }
}
