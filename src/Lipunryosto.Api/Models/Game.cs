using System.ComponentModel.DataAnnotations;

namespace Lipunryosto.Api.Models
{
    public class Game
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        [Required, MaxLength(200)]
        public string Name { get; set; } = default!;

        // Pelimekaniikka
        public int CaptureTimeSeconds { get; set; } = 60;
        [MaxLength(50)]
        public string WinCondition { get; set; } = "MostPointsAtTime"; // MostPointsAtTime | AllFlagsOneTeam
        public int? TimeLimitMinutes { get; set; }
        public int? MaxPoints { get; set; }
        public string? ArenaName { get; set; }

        // Peli-tila (ScoringService odottaa tätä)
        public GameStatus Status { get; set; } = GameStatus.NotStarted;
        public DateTimeOffset? StartedAtUtc { get; set; }
        public DateTimeOffset? EndedAtUtc { get; set; }

        // Julkinen linkki / OTP
        public string? PublicUrlToken { get; set; }
        public string? OtpHash { get; set; }

        // Ylläpito
        public bool IsArchived { get; set; } = false;
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        // Navigaatio
        public ICollection<Team> Teams { get; set; } = new List<Team>();

        // Yhteensopivuus: jotkin kontrollerit käyttävät TeamList-nimeä
        public ICollection<Team> TeamList => Teams;
    }
}
