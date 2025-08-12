
using System;
using System.Linq;
namespace Lipunryosto.Api.Services;
public class OtpService {
  public string Hash(string otp)=>BCrypt.Net.BCrypt.HashPassword(otp);
  public bool Verify(string otp, string hash)=>BCrypt.Net.BCrypt.Verify(otp, hash);
  public string Generate(int len=8){
    var rng=new Random();
    const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    int half = Math.Max(1, len / 2);
    string Part() => new string(Enumerable.Range(0, half).Select(_=>chars[rng.Next(chars.Length)]).ToArray());
    return $"{Part()}-{Part()}";
  }
}
