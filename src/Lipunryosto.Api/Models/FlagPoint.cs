
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace Lipunryosto.Api.Models;
public class FlagPoint {
  [Key] public Guid Id {get;set;}=Guid.NewGuid();
  [Required] public Guid GameId {get;set;}
  [ForeignKey(nameof(GameId))] public Game Game {get;set;}=default!;
  public string Name {get;set;}="Flag";
  public double Lat {get;set;}
  public double Lon {get;set;}
  public string Color {get;set;}="blue";
  public int Points {get;set;}=10;
  public string Status {get;set;}="open";
  public Guid? DeviceId {get;set;}
  public DateTimeOffset? LastCapturedAt {get;set;}
  public Guid? OwnerTeamId {get;set;} // uusi: nykyinen omistaja
}
