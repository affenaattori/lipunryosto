using Lipunryosto.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Data
{
    public partial class AppDb : DbContext
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Game>()
                .HasMany(g => g.Teams)
                .WithOne(t => t.Game)
                .HasForeignKey(t => t.GameId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Game>()
                .HasMany(g => g.Flags)
                .WithOne(f => f.Game)
                .HasForeignKey(f => f.GameId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Game>()
                .Property(g => g.WinCondition)
                .HasDefaultValue("MostPointsAtTime");
        }
    }
}
