
namespace Lipunryosto.Api.Services;
public class OtpService {
  public string Hash(string otp)=>BCrypt.Net.BCrypt.HashPassword(otp);
  public bool Verify(string otp, string hash)=>BCrypt.Net.BCrypt.Verify(otp, hash);
  public string Generate(int len=8){ var rng=new Random(); string chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; string part()=>new string(Enumerable.Range(0,len//2).Select(_=>chars[rng.Next(chars.Length)]).ToArray()); return part()+"-"+part();}
}
