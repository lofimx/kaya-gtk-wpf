namespace Kaya.Core.Models;

public interface IClock
{
    DateTimeOffset Now();
}

public class SystemClock : IClock
{
    public DateTimeOffset Now() => DateTimeOffset.UtcNow;
}

public class FrozenClock : IClock
{
    private readonly DateTimeOffset _instant;

    public FrozenClock(DateTimeOffset instant) => _instant = instant;

    public DateTimeOffset Now() => _instant;
}
