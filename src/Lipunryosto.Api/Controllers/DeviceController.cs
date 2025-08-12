
using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Lipunryosto.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Lipunryosto.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
namespace Lipunryosto.Api.Controllers;
[ApiController]
[Route("device")]
public class DeviceController : ControllerBase{
  private readonly AppDb _db; private readonly OtpService _otp; private readonly ScoringService _scoring; private readonly IOptions<CaptureOptions> _cap; private readonly IHubContext<AdminHub> _admin; private readonly IHubContext<PublicHub> _public;
  public DeviceController(AppDb db, OtpService otp, ScoringService scoring, IOptions<CaptureOptions> cap, IHubContext<AdminHub> admin, IHubContext<PublicHub> pub){_db=db;_otp=otp;_scoring=scoring;_cap=cap;_admin=admin;_public=pub;}
  public record DeviceOpenDto(Guid GameId,string Otp,string? Name);
  [HttpPost("open")] public async Task<IActionResult> Open([FromBody] DeviceOpenDto dto){
    var g=await _db.Games.FirstOrDefaultAsync(x=>x.Id==dto.GameId); if(g is null || string.IsNullOrWhiteSpace(g.OtpHash)) return Unauthorized();
    if(!_otp.Verify(dto.Otp,g.OtpHash)) return Unauthorized();
    var d=new Device{ GameId=g.Id, Name=dto.Name }; _db.Devices.Add(d); await _db.SaveChangesAsync();
    var token = Convert.ToBase64String(Guid.NewGuid().ToByteArray()); d.DeviceTokenHash = token; await _db.SaveChangesAsync();
    return Ok(new { deviceId=d.Id, deviceToken=token, assignedFlagId=d.AssignedFlagId });
  }
  public record CaptureDto(Guid TeamId,string Phase,double? Lat,double? Lon,double? Accuracy);
  [HttpPost("flags/{flagId:guid}/capture")] public async Task<IActionResult> Capture(Guid flagId,[FromBody] CaptureDto dto){
    var f=await _db.Flags.FirstOrDefaultAsync(x=>x.Id==flagId); if(f is null) return NotFound();
    var g=await _db.Games.FirstAsync(x=>x.Id==f.GameId); if(g.Status!="live") return BadRequest("Game not live");
    var now=DateTimeOffset.UtcNow;
    var ev=new CaptureEvent{ GameId=g.Id, FlagId=f.Id, TeamId=dto.TeamId, Phase=dto.Phase, Lat=dto.Lat, Lon=dto.Lon, Accuracy=dto.Accuracy, Timestamp=now };
    _db.Events.Add(ev); await _db.SaveChangesAsync();
    await _admin.Clients.All.SendAsync("eventCreated", new { gameId=g.Id, evId=ev.Id, phase=ev.Phase, flagId=f.Id, teamId=ev.TeamId, ts=ev.Timestamp });
    await _public.Clients.All.SendAsync("eventCreated", new { gameId=g.Id, evId=ev.Id, phase=ev.Phase, flagId=f.Id, teamId=ev.TeamId, ts=ev.Timestamp });
    if(dto.Phase=="confirm"){
      var start = await _db.Events.Where(x=>x.GameId==g.Id && x.FlagId==f.Id && x.TeamId==dto.TeamId && x.Phase=="start").OrderByDescending(x=>x.Timestamp).FirstOrDefaultAsync();
      if(start is null) return BadRequest("Start not found");
      var elapsed = now - start.Timestamp;
      if(elapsed.TotalSeconds + _cap.Value.ConfirmGraceSeconds < g.CaptureTimeSeconds) return BadRequest("Confirm too early");
      if(dto.Lat.HasValue && dto.Lon.HasValue && f.Lat!=0 && f.Lon!=0){
        var dist = GeoHelper.Haversine(f.Lat,f.Lon,dto.Lat.Value,dto.Lon.Value);
        if(dist > _cap.Value.GeofenceMeters) return BadRequest("Out of geofence");
      }
      await _scoring.AwardAsync(g.Id, dto.TeamId, f.Points);
      f.LastCapturedAt = now; await _db.SaveChangesAsync();
      await _admin.Clients.All.SendAsync("flagUpdated", new { gameId=g.Id, flagId=f.Id, lastCapturedAt=f.LastCapturedAt });
      await _public.Clients.All.SendAsync("flagUpdated", new { gameId=g.Id, flagId=f.Id, lastCapturedAt=f.LastCapturedAt });
    }
    return Ok(ev);
  }
}
