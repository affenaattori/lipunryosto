using System.ComponentModel.DataAnnotations;

namespace Lipunryosto.Api.Models
{
    public class Device
    {
        [Key] public Guid Id { get; set; } = Guid.NewGuid();

        public Guid? GameId { get; set; }
        public Guid? AssignedFlagId { get; set; }

        [MaxLength(120)]
        public string? Name { get; set; }

        [MaxLength(100)]
        public string? PwaInstanceId { get; set; }

        [MaxLength(100)]
        public string? Token { get; set; }

        [MaxLength(160)]
        public string? DeviceTokenHash { get; set; }

        public double? Lat { get; set; }
        public double? Lon { get; set; }
        public double? AccuracyMeters { get; set; }
        public DateTimeOffset? LastSeen { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
