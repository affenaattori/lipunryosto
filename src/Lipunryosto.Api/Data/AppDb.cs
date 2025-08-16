using Microsoft.EntityFrameworkCore;
using Lipunryosto.Api.Models;

namespace Lipunryosto.Api.Data
{
    public partial class AppDb : DbContext
    {
        public AppDb(DbContextOptions<AppDb> options) : base(options) { }

        // DbSets
        public DbSet<Game> Games => Set<Game>();
        public DbSet<Team> Teams => Set<Team>();
        public DbSet<FlagPoint> Flags => Set<FlagPoint>();
        public DbSet<Device> Devices => Set<Device>();
        public DbSet<CaptureEvent> Events => Set<CaptureEvent>();
        public DbSet<GameArea> Areas => Set<GameArea>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Yksi peli = yksi pelialue (uniikki GameId)
            modelBuilder.Entity<GameArea>()
                .HasIndex(x => x.GameId)
                .IsUnique();

            // Huom: jos sinulla on toinen partial-luokka, jossa on myös OnModelCreating,
            // pidä indeksit yhdessä paikassa tai yhdistä ne, jotta ei tule ristiriitoja.
        }
    }
}
