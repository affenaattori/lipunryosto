using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lipunryosto.Api.Models
{
    public class GameEvent
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        [Required] public Guid GameId { get; set; }
        public Guid? TeamId { get; set; }
        public Guid? FlagId { get; set; }

        [MaxLength(64)]
        public string Type { get; set; } = "info"; // esim. capture, score, start, end

        public int? Points { get; set; }

        [MaxLength(200)]
        public string? Message { get; set; }

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
