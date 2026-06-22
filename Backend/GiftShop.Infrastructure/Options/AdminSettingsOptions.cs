namespace GiftShop.Infrastructure.Options;

public sealed class AdminSettingsOptions
{
    public const string SectionName = "AdminSettings";

    public List<string>? AllowedIps { get; set; }

    public string? SecretPreAuthKey { get; set; }

    /// <summary>
    /// Base32-encoded TOTP secret. Generate once with any TOTP tool and store in
    /// environment variable ADMINSETTINGS__TOTPSECRET (or appsettings.json for local dev).
    /// The same value is scanned into Google Authenticator / Aegis as a manual entry.
    /// Example (32-char Base32): JBSWY3DPEHPK3PXP
    /// </summary>
    public string? TotpSecret { get; set; }

    /// <summary>
    /// Whether the TOTP stage (Stage 2) is required during admin login.
    /// Defaults to true. Can be toggled from the Security page inside the
    /// admin portal — requires supplying a valid TOTP code to change, so the
    /// secret must be set up before disabling.
    /// When false the login flow goes: Pre-auth key → Credentials (2 stages).
    /// When true  the login flow goes: Pre-auth key → TOTP → Credentials (3 stages).
    /// </summary>
    // public bool IsTotpEnabled { get; set; } = true;

    public string? AdminUserName { get; set; }

    public string? AdminPassword { get; set; }

    public void Normalize()
    {
        AllowedIps ??= new List<string>();

        // Always guarantee at least loopback + hardcoded fallback
        foreach (var ip in new[] { "127.0.0.1", "::1", "192.168.1.7" })
        {
            if (!AllowedIps.Contains(ip, StringComparer.OrdinalIgnoreCase))
                AllowedIps.Add(ip);
        }

        AllowedIps = AllowedIps
            .Where(ip => !string.IsNullOrWhiteSpace(ip))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}

public sealed class CloudinarySettingsOptions
{
    public const string SectionName = "CloudinarySettings";

    public string CloudName { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string ApiSecret { get; set; } = string.Empty;
}

public sealed class JwtSettingsOptions
{
    public const string SectionName = "JwtSettings";

    public string SecretKey { get; set; } = "giftshop-dev-secret-key-32-chars!";
    public string Issuer { get; set; } = "GiftShop.Api";
    public string Audience { get; set; } = "GiftShop.Admin";
    public int ExpiryMinutes { get; set; } = 480;
}