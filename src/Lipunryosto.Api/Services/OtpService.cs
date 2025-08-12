using System;
using System.Linq;

namespace Lipunryosto.Api.Services
{
    public class OtpService
    {
        public string Hash(string otp) => BCrypt.Net.BCrypt.HashPassword(otp);

        public bool Verify(string otp, string hash) => BCrypt.Net.BCrypt.Verify(otp, hash);

        public string Generate(int len = 8)
        {
            // Tuottaa esim. "ABCD-1234" (puolet merkeistä ennen ja jälkeen väliviivan)
            var rng = new Random();
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ei I/O/0/1

            int half = Math.Max(1, len / 2);
            string Part() => new string(Enumerable.Range(0, half)
                                   .Select(_ => chars[rng.Next(chars.Length)])
                                   .ToArray());

            return $"{Part()}-{Part()}";
        }
    }
}
