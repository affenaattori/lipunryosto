using Lipunryosto.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Data
{
    // Tämä on osittaisluokka, joka täydentää olemassa olevaa AppDb:tä.
    public partial class AppDb : DbContext
    {
        public DbSet<Game> Games => Set<Game>();
        public DbSet<Team> Teams => Set<Team>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Game>()
                .HasMany(g => g.Teams)
                .WithOne(t => t.Game)
                .HasForeignKey(t => t.GameId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Game>()
                .Property(g => g.WinCondition)
                .HasDefaultValue("MostPointsAtTime");
        }
    }
}
