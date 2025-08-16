using Lipunryosto.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// CORS: salli SWA-origin
var swaOrigin = builder.Configuration["SWA_ORIGIN"]; // esim. https://red-coast-0e21fd303.2.azurestaticapps.net
builder.Services.AddCors(opt =>
{
    opt.AddDefaultPolicy(p =>
        p.WithOrigins(
            swaOrigin ?? "https://red-coast-0e21fd303.2.azurestaticapps.net" // vaihda omaan SWA-osoitteeseesi
        )
        .AllowAnyHeader()
        .AllowAnyMethod());
});
...
var app = builder.Build();
app.UseCors();


// InMemory toggle
var useInMemory = (builder.Configuration["USE_INMEMORY"] ?? "").ToLowerInvariant() == "true";
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

// ÄLÄ kutsu db.Database.Migrate() kun InMemory on päällä
// (jos käytät migraatioita, tee se vain kun !useInMemory)

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Yksinkertainen globaali virheloki, ettei 500 jää piiloon
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

Console.WriteLine("USE_INMEMORY=" + useInMemory);
Console.WriteLine("EF Provider: " + app.Services.GetRequiredService<AppDb>().Database.ProviderName);

app.Run();
