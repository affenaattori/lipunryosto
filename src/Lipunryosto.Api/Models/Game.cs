using System.ComponentModel.DataAnnotations;

namespace Lipunryosto.Api.Models
{
    public class Game
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        [Required, MaxLength(200)]
        public string Name { get; set; } = default!;

        // Mechanics
        public int CaptureTimeSeconds { get; set; } = 60;
        [MaxLength(50)]
        public string WinCondition { get; set; } = "MostPointsAtTime";
        public int? TimeLimitMinutes { get; set; }
        public int? MaxPoints { get; set; }
        public string? ArenaName { get; set; }

        // Status
        public GameStatus Status { get; set; } = GameStatus.NotStarted;
        public DateTimeOffset? StartedAtUtc { get; set; }
        public DateTimeOffset? EndedAtUtc { get; set; }

        // Tokens
        public string? PublicUrlToken { get; set; }
        public string? OtpHash { get; set; }

        // Housekeeping
        public bool IsArchived { get; set; } = false;
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        // Navigation
        public ICollection<Team> Teams { get; set; } = new List<Team>();
        public ICollection<FlagPoint> Flags { get; set; } = new List<FlagPoint>();

        // Compatibility aliases
        public ICollection<Team> TeamList => Teams;
        public ICollection<FlagPoint> FlagPoints => Flags;
    }
}
