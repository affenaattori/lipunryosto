using Lipunryosto.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Data
{
    public partial class AppDb : DbContext
    {
        public AppDb(DbContextOptions<AppDb> options) : base(options) { }

        public DbSet<Game> Games => Set<Game>();
        public DbSet<Team> Teams => Set<Team>();
        public DbSet<FlagPoint> Flags => Set<FlagPoint>();
        public DbSet<Device> Devices => Set<Device>();
        public DbSet<CaptureEvent> Events => Set<CaptureEvent>();
        public DbSet<Lipunryosto.Api.Models.GameArea> Areas => Set<Lipunryosto.Api.Models.GameArea>();
        
 protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // 🔽 TÄHÄN voi laittaa uniikki-indeksin
        modelBuilder.Entity<GameArea>()
            .HasIndex(x => x.GameId)
            .IsUnique();

    }
}
