
namespace Lipunryosto.Api.Services;
public static class GeoHelper {
  public static double Haversine(double lat1,double lon1,double lat2,double lon2){
    double R=6371000, dLat=ToRad(lat2-lat1), dLon=ToRad(lon2-lon1); lat1=ToRad(lat1); lat2=ToRad(lat2);
    double a = Math.Sin(dLat/2)*Math.Sin(dLat/2)+System.Math.Cos(lat1)*System.Math.Cos(lat2)*System.Math.Sin(dLon/2)*System.Math.Sin(dLon/2);
    double c = 2*System.Math.Atan2(System.Math.Sqrt(a), System.Math.Sqrt(1-a)); return R*c;
  }
  static double ToRad(double deg)=>deg*System.Math.PI/180.0;
}
