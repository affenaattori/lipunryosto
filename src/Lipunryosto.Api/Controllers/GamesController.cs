
using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Lipunryosto.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Controllers;
[ApiController]
[Route("[controller]")]
public class GamesController : ControllerBase {
  private readonly AppDb _db; private readonly OtpService _otp;
  public GamesController(AppDb db, OtpService otp){ _db=db; _otp=otp; }

  [HttpGet] public async Task<IActionResult> List()=>Ok(await _db.Games.OrderByDescending(g=>g.StartTime).ToListAsync());

  public record GameCreateDto(string Name,int Teams,int Flags,int MaxPoints,int MaxDurationMinutes,int CaptureTimeSeconds,string CaptureMode,string? AreaGeoJson);
  [HttpPost]
  public async Task<IActionResult> Create([FromBody] GameCreateDto dto){
    var g = new Game{ Name=dto.Name, Teams=dto.Teams, Flags=dto.Flags, MaxPoints=dto.MaxPoints, MaxDurationMinutes=dto.MaxDurationMinutes, CaptureTimeSeconds=dto.CaptureTimeSeconds, CaptureMode=dto.CaptureMode, AreaGeoJson=dto.AreaGeoJson, Status="live" };
    var otp = _otp.Generate(); g.OtpHash = _otp.Hash(otp);
    _db.Games.Add(g); await _db.SaveChangesAsync();
    return Ok(new { game=g, otp });
  }

  [HttpGet("{id:guid}")] public async Task<IActionResult> Get(Guid id){ var g=await _db.Games.FindAsync(id); return g is null? NotFound(): Ok(g); }

  [HttpPatch("{id:guid}")] public async Task<IActionResult> Patch(Guid id,[FromBody] Dictionary<string,object> p){
    var g=await _db.Games.FindAsync(id); if (g is null) return NotFound();
    foreach(var kv in p){
      switch(kv.Key){
        case "Name": g.Name = kv.Value?.ToString() ?? g.Name; break;
        case "MaxPoints": g.MaxPoints = Convert.ToInt32(kv.Value); break;
        case "MaxDurationMinutes": g.MaxDurationMinutes = Convert.ToInt32(kv.Value); break;
        case "CaptureTimeSeconds": g.CaptureTimeSeconds = Convert.ToInt32(kv.Value); break;
        case "CaptureMode": g.CaptureMode = kv.Value?.ToString() ?? g.CaptureMode; break;
        case "Status": g.Status = kv.Value?.ToString() ?? g.Status; break;
        case "AreaGeoJson": g.AreaGeoJson = kv.Value?.ToString(); break;
      }
    }
    await _db.SaveChangesAsync(); return Ok(g);
  }

  [HttpPost("{id:guid}/generate-public-link")]
  public async Task<IActionResult> PublicLink(Guid id){
    var g=await _db.Games.FindAsync(id); if(g is null) return NotFound();
    g.PublicUrlToken = Convert.ToBase64String(Guid.NewGuid().ToByteArray()).Replace("+","" ).Replace("/","").Replace("=","" ).Substring(0,10);
    await _db.SaveChangesAsync();
    return Ok(new { publicUrl = $"https://peli.example.com/view/{g.PublicUrlToken}" });
  }
}
