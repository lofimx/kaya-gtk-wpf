using System.Text.RegularExpressions;

namespace Kaya.Core.Models;

public partial class Filename
{
    private readonly string _value;

    public Filename(string filename) => _value = filename;

    public string Value => _value;

    public bool IsValid() => !InvalidCharsRegex().IsMatch(_value);

    [GeneratedRegex(@"[ #?&+=!*'()<>\[\]{}\""@^~`;\\|]")]
    private static partial Regex InvalidCharsRegex();
}
