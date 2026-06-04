using System.Text;

namespace GiftShop.Api.Configuration;

public static class DotEnvLoader
{
    public static void Load(string? path = null)
    {
        var filePath = path ?? Path.Combine(Directory.GetCurrentDirectory(), ".env");

        if (!File.Exists(filePath))
        {
            return;
        }

        foreach (var line in File.ReadAllLines(filePath, Encoding.UTF8))
        {
            var trimmed = line.Trim();
            if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith('#'))
            {
                continue;
            }

            var separatorIndex = trimmed.IndexOf('=');
            if (separatorIndex <= 0)
            {
                continue;
            }

            var key = trimmed[..separatorIndex].Trim();
            var value = trimmed[(separatorIndex + 1)..].Trim().Trim('"');

            if (key.StartsWith("export ", StringComparison.OrdinalIgnoreCase))
            {
                key = key[7..].Trim();
            }

            Environment.SetEnvironmentVariable(key, value);
        }
    }
}
