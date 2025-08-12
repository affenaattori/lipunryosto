using System.ComponentModel.DataAnnotations;

namespace Lipunryosto.Api.Models
{
    public class Game
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        [Required, MaxLength(200)]
        public string Name { get; set; } = default!;

        // Pelimekaniikka
        public int CaptureTimeSeconds { get; set; } = 60;      // valtauksen kesto
        [MaxLength(50)]
        public string WinCondition { get; set; } = "MostPointsAtTime"; // MostPointsAtTime | AllFlagsOneTeam
        public int? TimeLimitMinutes { get; set; }             // null = ei aikarajaa
        public int? MaxPoints { get; set; }                    // null = ei pistekattoa
        public string? ArenaName { get; set; }

        // Julkisen puolen ja laitelukituksen tuki (valinnaista)
        public string? PublicUrlToken { get; set; }
        public string? OtpHash { get; set; }

        // Ylläpito
        public bool IsArchived { get; set; } = false;
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        // Navigaatio
        public ICollection<Team> Teams { get; set; } = new List<Team>();
    }
}
