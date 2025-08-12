using System.ComponentModel.DataAnnotations;

namespace Lipunryosto.Api.Models
{
    public class CaptureEvent
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        [Required] public Guid GameId { get; set; }
        [Required] public Guid FlagId { get; set; }
        [Required] public Guid TeamId { get; set; }

        [MaxLength(20)]
        public string Phase { get; set; } = "start";

        public double? Lat { get; set; }
        public double? Lon { get; set; }
        public double? Accuracy { get; set; }

        public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    }
}
