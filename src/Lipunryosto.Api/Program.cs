
using Lipunryosto.Api.Data;
using Lipunryosto.Api.Hubs;
using Lipunryosto.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Lipunryosto.Api;

var builder = WebApplication.CreateBuilder(args);

var useSql = builder.Configuration.GetValue<bool>("Database:UseSqlServer");
if (useSql)
    builder.Services.AddDbContext<AppDb>(opt => opt.UseSqlServer(builder.Configuration.GetConnectionString("Sql")));
else
    builder.Services.AddDbContext<AppDb>(opt => opt.UseInMemoryDatabase("lipunryosto-dev"));

builder.Services.AddSignalR();
if (builder.Configuration.GetValue<bool>("SignalR:UseAzure"))
    builder.Services.AddSignalR().AddAzureSignalR(builder.Configuration["Azure:SignalR:ConnectionString"]);

builder.Services.Configure<CaptureOptions>(builder.Configuration.GetSection("Capture"));
builder.Services.AddScoped<OtpService>();
builder.Services.AddScoped<ScoringService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => c.SwaggerDoc("v1", new OpenApiInfo { Title="Lipunryöstö Admin API", Version="v1" }));
builder.Services.AddCors(opt => opt.AddPolicy("default", p => p.AllowAnyHeader().AllowAnyMethod().AllowCredentials().SetIsOriginAllowed(_=>true)));

var app = builder.Build();
app.UseCors("default");
if (app.Environment.IsDevelopment()){
    app.UseSwagger(); app.UseSwaggerUI();
}
app.MapControllers();
app.MapHub<AdminHub>("/hubs/admin");
app.MapHub<PublicHub>("/hubs/public");
app.MapHub<DeviceHub>("/hubs/device");
app.MapGet("/healthz", () => Results.Ok(new { ok = true, env = app.Environment.EnvironmentName }));
app.Run();
