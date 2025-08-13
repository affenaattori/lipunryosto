using System.Security.Cryptography;
using System.Text;
using Lipunryosto.Api.Data;
using Lipunryosto.Api.Models;
using Lipunryosto.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lipunryosto.Api.Controllers
{
    [ApiController]
    [Route("games")]
    public class GamesOtpController : ControllerBase
    {
        private readonly AppDb _db;
        private readonly OtpService _otp;
        public GamesOtpController(AppDb db, OtpService otp)
        {
            _db = db; _otp = otp;
        }

        // Generoi uusi OTP tälle pelille, tallettaa hashin ja palauttaa plain-OTP:n (näytetään vain tässä vastauksessa)
        [HttpPost("{id:guid}/generate-otp")]
        public async Task<IActionResult> Generate(Guid id)
        {
            var g = await _db.Games.FirstOrDefaultAsync(x => x.Id == id);
            if (g == null) return NotFound();

            // 6-numeroa (000000–999999)
            var bytes = RandomNumberGenerator.GetBytes(4);
            var n = BitConverter.ToUInt32(bytes, 0) % 1000000;
            var otp = n.ToString("D6");

            // Hashataan OtpServiceä käyttäen, jotta Verify toimii DeviceControllerissa
            var hash = HashOtp(otp);
            g.OtpHash = hash;
            await _db.SaveChangesAsync();

            return Ok(new { otp });
        }

        private string HashOtp(string otp)
        {
            // Jos OtpService tarjoaa oman Hash/Compute -metodin, käytä sitä:
            try
            {
                var mi = _otp.GetType().GetMethod("Hash", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic);
                if (mi != null)
                {
                    var res = mi.Invoke(_otp, new object[] { otp }) as string;
                    if (!string.IsNullOrEmpty(res)) return res!;
                }
            }
            catch { /* fallback below */ }

            // Fallback: SHA256(otp) hex — käytä vain jos OtpService ei tarjoa hashia
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(otp));
            return Convert.ToHexString(bytes);
        }
    }
}
