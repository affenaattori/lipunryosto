
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace Lipunryosto.Api.Models;
public class Device {
  [Key] public Guid Id {get;set;}=Guid.NewGuid();
  [Required] public Guid GameId {get;set;}
  [ForeignKey(nameof(GameId))] public Game Game {get;set;}=default!;
  public string? Name {get;set;}
  public string? DeviceTokenHash {get;set;}
  public Guid? AssignedFlagId {get;set;}
  public DateTimeOffset LastSeen {get;set;}=DateTimeOffset.UtcNow;
  public bool IsActive {get;set;}=true;
}
