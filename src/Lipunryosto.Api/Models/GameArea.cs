using System.ComponentModel.DataAnnotations;

namespace Lipunryosto.Api.Models
{
    public class GameArea
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();
        [Required] public Guid GameId { get; set; }
        [Required] public string GeoJson { get; set; } = "{}"; // GeoJSON Feature (Polygon)
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
