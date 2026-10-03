namespace GiftShop.Infrastructure.Options;

public sealed class EmailSettingsOptions
{
    public const string SectionName = "EmailSettings";

    /// <summary>
    /// Owner's personal email where order alert emails are delivered.
    /// Can be set via EmailSettings__OwnerEmail in .env or appsettings.json.
    /// </summary>
    public string OwnerEmail { get; set; } = string.Empty;

    /// <summary>
    /// SMTP Server Host (e.g., smtp.gmail.com).
    /// </summary>
    public string SmtpHost { get; set; } = "smtp.gmail.com";

    /// <summary>
    /// SMTP Port (e.g., 587 for StartTLS, 465 for SSL).
    /// </summary>
    public int SmtpPort { get; set; } = 587;

    /// <summary>
    /// Sender email address from which notifications are sent.
    /// </summary>
    public string SenderEmail { get; set; } = string.Empty;

    /// <summary>
    /// Password or Google App Password for the sender email.
    /// </summary>
    public string SenderPassword { get; set; } = string.Empty;

    /// <summary>
    /// Whether SSL/TLS should be enabled.
    /// </summary>
    public bool EnableSsl { get; set; } = true;

    /// <summary>
    /// Display name shown in the 'From' field of the email.
    /// </summary>
    public string SenderDisplayName { get; set; } = "Kalakaari Gift Shop";
}
