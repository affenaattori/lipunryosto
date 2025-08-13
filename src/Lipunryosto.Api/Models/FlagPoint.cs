using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lipunryosto.Api.Models
{
    public class FlagPoint
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        // Pakollinen FK peliin
        [Required] public Guid GameId { get; set; }

        // Navigaatio peliin (AppDb.Partial.cs odottaa f.Game -propertyä)
        [ForeignKey(nameof(GameId))]
        public Game Game { get; set; } = default!;

        // Näyttönimi (voidaan normalisoida A, B, C …)
        [MaxLength(120)]
        public string? Name { get; set; }

        // Sijainti (päivittyy myös Device/Heartbeatistä jos device on sidottu tähän lippuun)
        public double Lat { get; set; }
        public double Lon { get; set; }

        // Lipun arvo
        public int Points { get; set; } = 10;

        // Ulkoasu/admin-info
        [MaxLength(24)]
        public string? Color { get; set; }  // esim. "#FF0000" tai nimiväri

        [MaxLength(24)]
        public string? Status { get; set; } = "open"; // esim. "open"/"closed" tms.

        // Omistaja ja viimeisin valloitus
        public Guid? OwnerTeamId { get; set; }
        public DateTimeOffset? LastCapturedAt { get; set; }

        // Valinnainen, jos haluat järjestää tai debuggata
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
