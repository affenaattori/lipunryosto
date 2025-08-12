using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Lipunryosto.Api.Models
{
    public class Team
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        [Required] public Guid GameId { get; set; }
        [ForeignKey(nameof(GameId))] public Game Game { get; set; } = default!;

        [Required, MaxLength(120)]
        public string Name { get; set; } = default!;

        [MaxLength(32)]
        public string? Color { get; set; }

        public int Score { get; set; } = 0;
    }
}
