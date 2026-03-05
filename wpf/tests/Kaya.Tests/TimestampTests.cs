using Kaya.Core.Models;

namespace Kaya.Tests;

public class TimestampTests
{
    private static readonly DateTimeOffset TestTime =
        new(2005, 8, 9, 12, 34, 56, 789, TimeSpan.Zero);

    private static readonly FrozenClock Clock = new(TestTime);

    [Fact]
    public void Should_print_a_custom_timestamp()
    {
        var ts = new KayaTimestamp(Clock.Now());
        Assert.Equal("2005-08-09T123456", ts.Plain);
        Assert.Equal("2005-08-09T123456_789000000", ts.WithNanos);
    }

    [Fact]
    public void Should_handle_zero_milliseconds()
    {
        var time = new DateTimeOffset(2005, 8, 9, 12, 34, 56, TimeSpan.Zero);
        var ts = new KayaTimestamp(time);
        Assert.Equal("2005-08-09T123456", ts.Plain);
        Assert.Equal("2005-08-09T123456_000000000", ts.WithNanos);
    }
}
