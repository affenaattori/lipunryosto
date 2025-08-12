using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lipunryosto.Api.Models
{
    public class FlagPoint
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        [Required] public Guid GameId { get; set; }

        [ForeignKey(nameof(GameId))] public Game Game { get; set; } = default!;

        [MaxLength(80)]
        public string? Name { get; set; }

        public double Lat { get; set; }
        public double Lon { get; set; }

        public int Points { get; set; } = 10;

        [MaxLength(24)]
        public string? Color { get; set; }

        [MaxLength(24)]
        public string Status { get; set; } = "open"; // open/closed, etc.

        public Guid? OwnerTeamId { get; set; }
        public DateTimeOffset? LastCapturedAt { get; set; }
    }
}
