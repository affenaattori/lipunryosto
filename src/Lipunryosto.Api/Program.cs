using Lipunryosto.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------
// CORS (salli SWA-frontendin domaini)
// Aseta Azure App Settingsissä: SWA_ORIGIN = https://<swa>.azurestaticapps.net
// ---------------------------------------------------------
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
            // Fallback: salli kaikki (kehitys)
            policy.AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }
    });
});

// ---------------------------------------------------------
// Tietokanta: InMemory toggle ympäristömuuttujalla USE_INMEMORY=true
// Muuten käytetään ConnectionStrings:Default (SQL Server tms.)
// ---------------------------------------------------------
var useInMemory = (builder.Configuration["USE_INMEMORY"] ?? "")
    .Equals("true", StringComparison.OrdinalIgnoreCase);

if (useInMemory)
{
    builder.Services.AddDbContext<AppDb>(opt =>
        opt.UseInMemoryDatabase("LipunryostoDb"));
}
else
{
    var conn = builder.Configuration.GetConnectionString("Default");
    builder.Services.AddDbContext<AppDb>(opt =>
        opt.UseSqlServer(conn));
}

// ---------------------------------------------------------
// Palvelut ja MVC
// ---------------------------------------------------------
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Jos sinulla on palveluja, jotka injektoidaan controllereihin,
// rekisteröi ne tähän. (Esim. ScoringService.)
// builder.Services.AddScoped<Lipunryosto.Api.Services.ScoringService>();

var app = builder.Build();

// ---------------------------------------------------------
// Middlewaret
// ---------------------------------------------------------
app.UseCors("SWA");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// (Valinnainen) Kevyt globaali virheloki, jos haluat:
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

// Tulosta konsoliin käytössä oleva EF-provideri (diagnostiikka)
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    Console.WriteLine("USE_INMEMORY=" + useInMemory);
    Console.WriteLine("EF Provider: " + (db.Database.ProviderName ?? "unknown"));
}
catch
{
    // ei kaadeta ajossa diag-tulosteen takia
}

app.Run();
