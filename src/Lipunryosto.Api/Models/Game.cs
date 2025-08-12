
using System.ComponentModel.DataAnnotations;
namespace Lipunryosto.Api.Models;
public class Game {
  [Key] public Guid Id {get;set;}=Guid.NewGuid();
  [Required] public string Name {get;set;}=default!;
  public string Status {get;set;}="live";
  public DateTimeOffset StartTime {get;set;}=DateTimeOffset.UtcNow;
  public DateTimeOffset? EndTime {get;set;}
  public int Teams {get;set;}=2;
  public int Flags {get;set;}=4;
  public int MaxPoints {get;set;}=100;
  public int MaxDurationMinutes {get;set;}=30;
  public int CaptureTimeSeconds {get;set;}=60;
  public string CaptureMode {get;set;}="two-click";
  public string? OtpHash {get;set;}
  public string? PublicUrlToken {get;set;}
  public string? AreaGeoJson {get;set;}
  public List<Team> TeamList {get;set;}=new();
  public List<FlagPoint> FlagPoints {get;set;}=new();
}
