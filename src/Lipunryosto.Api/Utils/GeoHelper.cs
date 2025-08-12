namespace Lipunryosto.Api
{
    public static class GeoHelper
    {
        // Returns meters
        public static double Haversine(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371000.0; // meters
            double dLat = ToRad(lat2 - lat1);
            double dLon = ToRad(lon2 - lon1);
            double a = 
                System.Math.Sin(dLat/2) * System.Math.Sin(dLat/2) +
                System.Math.Cos(ToRad(lat1)) * System.Math.Cos(ToRad(lat2)) *
                System.Math.Sin(dLon/2) * System.Math.Sin(dLon/2);
            double c = 2 * System.Math.Atan2(System.Math.Sqrt(a), System.Math.Sqrt(1-a));
            return R * c;
        }

        private static double ToRad(double deg) => deg * System.Math.PI / 180.0;
    }
}
