using Microsoft.EntityFrameworkCore;
using Lipunryosto.Api.Models;

namespace Lipunryosto.Api.Data
{
    public class AppDb : DbContext
    {
        public AppDb(DbContextOptions<AppDb> options) : base(options) { }

        public DbSet<Game> Games { get; set; }
        public DbSet<Team> Teams { get; set; }
        public DbSet<FlagPoint> Flags { get; set; }
        public DbSet<Device> Devices { get; set; }
        public DbSet<CaptureEvent> Events { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Yksi peli – uniikki GameId flagille
            modelBuilder.Entity<FlagPoint>()
                .HasIndex(f => new { f.GameId, f.Name })
                .IsUnique();
        }
    }
}
