using Lipunryosto.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Data
{
    public partial class AppDb : DbContext
    {
        public AppDb(DbContextOptions<AppDb> options) : base(options) {}

        public DbSet<Game> Games => Set<Game>();
        public DbSet<Team> Teams => Set<Team>();
        public DbSet<FlagPoint> Flags => Set<FlagPoint>();
    }
}
