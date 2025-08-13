using Lipunryosto.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Data
{
    public partial class AppDb : DbContext
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Game -> Teams
            modelBuilder.Entity<Game>()
                .HasMany(g => g.Teams)
                .WithOne(t => t.Game)
                .HasForeignKey(t => t.GameId)
                .OnDelete(DeleteBehavior.Cascade);

            // Game -> Flags
            modelBuilder.Entity<Game>()
                .HasMany(g => g.Flags)
                .WithOne(f => f.Game)
                .HasForeignKey(f => f.GameId)
                .OnDelete(DeleteBehavior.Cascade);

            // Oletuksia
            modelBuilder.Entity<Game>()
                .Property(g => g.WinCondition)
                .HasDefaultValue("MostPointsAtTime");

            modelBuilder.Entity<Team>()
                .Property(t => t.Score)
                .HasDefaultValue(0);

            modelBuilder.Entity<FlagPoint>()
                .Property(f => f.Status)
                .HasMaxLength(24);

            modelBuilder.Entity<FlagPoint>()
                .Property(f => f.Color)
                .HasMaxLength(24);
        }
    }
}
