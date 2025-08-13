using System.ComponentModel.DataAnnotations;

namespace Lipunryosto.Api.Models
{
    public class FlagPoint
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        public Guid GameId { get; set; }

        [MaxLength(120)]
        public string Name { get; set; } = "";

        // GPS-sijainti
        public double Lat { get; set; }
        public double Lon { get; set; }

        public int Points { get; set; } = 1;

        public Guid? OwnerTeamId { get; set; }
        public DateTimeOffset? LastCapturedAt { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
