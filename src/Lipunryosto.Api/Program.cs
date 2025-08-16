using Lipunryosto.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// CORS SWA:lle (aseta Azure App Settings: SWA_ORIGIN = https://<oma-swa>.azurestaticapps.net)
var swaOrigin = builder.Configuration["SWA_ORIGIN"];
builder.Services.AddCors(options =>
{
    options.AddPolicy("SWA", policy =>
    {
        if (!string.IsNullOrWhiteSpace(swaOrigin))
        {
            policy.WithOrigins(swaOrigin)
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }
        else
        {
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        }
    });
});

// DB: InMemory toggle (USE_INMEMORY=true) tai SQL (ConnectionStrings:Default)
var useInMemory = (builder.Configuration["USE_INMEMORY"] ?? "")
    .Equals("true", StringComparison.OrdinalIgnoreCase);

if (useInMemory)
{
    builder.Services.AddDbContext<AppDb>(opt => opt.UseInMemoryDatabase("LipunryostoDb"));
}
else
{
    var conn = builder.Configuration.GetConnectionString("Default");
    builder.Services.AddDbContext<AppDb>(opt => opt.UseSqlServer(conn));
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Jos tarvitset palveluja, rekisteröi ne tähän:
// builder.Services.AddScoped<Lipunryosto.Api.Services.ScoringService>();

var app = builder.Build();

app.UseCors("SWA");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Globaali virheloki (kevyt)
app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (Exception ex)
    {
        Console.Error.WriteLine("UNHANDLED: " + ex);
        ctx.Response.StatusCode = 500;
        await ctx.Response.WriteAsync("Server error");
    }
});

app.MapControllers();

// Diag: tulosta provider
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    Console.WriteLine("USE_INMEMORY=" + useInMemory);
    Console.WriteLine("EF Provider: " + (db.Database.ProviderName ?? "unknown"));
}
catch { }

app.Run();
