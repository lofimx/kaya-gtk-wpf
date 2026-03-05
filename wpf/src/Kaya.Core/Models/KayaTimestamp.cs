namespace Kaya.Core.Models;

public class KayaTimestamp
{
    public string Plain { get; }
    public string WithNanos { get; }

    public KayaTimestamp(DateTimeOffset time)
    {
        var utc = time.UtcDateTime;
        // Format: "2005-08-09T123456"
        Plain = utc.ToString("yyyy-MM-dd'T'HHmmss");

        // Ticks give 100ns resolution. Convert remainder to nanoseconds (9 digits).
        long ticksOfSecond = utc.Ticks % TimeSpan.TicksPerSecond;
        long nanos = ticksOfSecond * 100; // 1 tick = 100 ns
        WithNanos = $"{Plain}_{nanos:D9}";
    }
}
