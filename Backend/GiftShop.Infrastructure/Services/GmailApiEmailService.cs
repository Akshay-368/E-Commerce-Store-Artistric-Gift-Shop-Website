using System.Globalization;
using System.Text;
using GiftShop.Application.Abstractions;
using GiftShop.Domain.Entities;
using GiftShop.Infrastructure.Options;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Gmail.v1;
using Google.Apis.Gmail.v1.Data;
using Google.Apis.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace GiftShop.Infrastructure.Services;

/// <summary>
/// Sends emails via the Gmail REST API over HTTPS (port 443).
/// This bypasses SMTP port restrictions on cloud platforms like Render.
/// 
/// Required environment variables:
///   - GmailApi__ClientId        (from Google Cloud Console)
///   - GmailApi__ClientSecret    (from Google Cloud Console)
///   - GmailApi__RefreshToken    (obtained once via OAuth Playground)
///   - EmailSettings__SenderEmail    (the Gmail address, e.g. gargakshay2004@gmail.com)
///   - EmailSettings__OwnerEmail     (the recipient email for order alerts)
/// </summary>
public sealed class GmailApiEmailService : IEmailService
{
    private readonly EmailSettingsOptions _emailOptions;
    private readonly IPdfInvoiceService _pdfInvoiceService;
    private readonly ILogger<GmailApiEmailService> _logger;

    private readonly string _clientId;
    private readonly string _clientSecret;
    private readonly string _refreshToken;

    public GmailApiEmailService(
        IOptions<EmailSettingsOptions> emailOptions,
        IConfiguration configuration,
        IPdfInvoiceService pdfInvoiceService,
        ILogger<GmailApiEmailService> logger)
    {
        _pdfInvoiceService = pdfInvoiceService;
        _logger = logger;

        // ── Resolve email settings (same logic as MailKit service) ──
        var opts = emailOptions.Value ?? new EmailSettingsOptions();
        opts.OwnerEmail = Resolve(opts.OwnerEmail,
            "EmailSettings:OwnerEmail", "EmailSettings__OwnerEmail", "OWNER_EMAIL",
            "Smtp:OwnerEmail", "Smtp__OwnerEmail")?.Trim() ?? string.Empty;

        opts.SenderEmail = Resolve(opts.SenderEmail,
            "EmailSettings:SenderEmail", "EmailSettings__SenderEmail", "SENDER_EMAIL",
            "Smtp:Username", "Smtp__Username", "Smtp:FromEmail", "Smtp__FromEmail")?.Trim() ?? string.Empty;

        opts.SenderDisplayName = Resolve(opts.SenderDisplayName,
            "EmailSettings:SenderDisplayName", "EmailSettings__SenderDisplayName")?.Trim()
            ?? "Kalakaari Gift Shop";

        _emailOptions = opts;

        // ── Resolve Gmail API OAuth credentials ──
        _clientId = Resolve(null,
            "GmailApi:ClientId", "GmailApi__ClientId", "GMAIL_API_CLIENT_ID")?.Trim() ?? string.Empty;

        _clientSecret = Resolve(null,
            "GmailApi:ClientSecret", "GmailApi__ClientSecret", "GMAIL_API_CLIENT_SECRET")?.Trim() ?? string.Empty;

        _refreshToken = Resolve(null,
            "GmailApi:RefreshToken", "GmailApi__RefreshToken", "GMAIL_API_REFRESH_TOKEN")?.Trim() ?? string.Empty;

        Console.WriteLine($"[GmailApiEmailService] Initialized. SenderEmail='{_emailOptions.SenderEmail}', " +
                          $"OwnerEmail='{_emailOptions.OwnerEmail}', " +
                          $"HasClientId={!string.IsNullOrWhiteSpace(_clientId)}, " +
                          $"HasClientSecret={!string.IsNullOrWhiteSpace(_clientSecret)}, " +
                          $"HasRefreshToken={!string.IsNullOrWhiteSpace(_refreshToken)}");

        string? Resolve(string? current, params string[] keys)
        {
            foreach (var key in keys)
            {
                var val = configuration[key] ?? Environment.GetEnvironmentVariable(key);
                if (!string.IsNullOrWhiteSpace(val))
                    return val;
            }
            return string.IsNullOrWhiteSpace(current) ? null : current;
        }
    }

    // ───────────────────────────────────────────────────────────
    //  IEmailService implementation
    // ───────────────────────────────────────────────────────────

    public async Task SendNewOrderAlertToOwnerAsync(Order order, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[GmailApiEmailService] Processing order alert for {order.PublicOrderNumber}...");

        if (string.IsNullOrWhiteSpace(_emailOptions.OwnerEmail))
        {
            Console.WriteLine("[GmailApiEmailService] ⚠️ Skipping: OwnerEmail not configured. " +
                              "Set EmailSettings__OwnerEmail in Render.");
            _logger.LogWarning("Skipping order alert: OwnerEmail not configured.");
            return;
        }

        var subject = $"🛒 New Order Received: {order.PublicOrderNumber} - ₹{order.TotalAmount:N2}";
        var htmlBody = BuildOrderAlertHtml(order);

        byte[]? pdfBytes = null;
        string? pdfName = null;
        try
        {
            pdfBytes = _pdfInvoiceService.GenerateInvoice(order);
            pdfName = $"Invoice-{order.PublicOrderNumber}.pdf";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GmailApiEmailService] ⚠️ PDF generation failed: {ex.Message}. Sending without attachment.");
            _logger.LogWarning(ex, "PDF generation failed for order {OrderNumber}.", order.PublicOrderNumber);
        }

        await SendEmailAsync(_emailOptions.OwnerEmail, subject, htmlBody, pdfBytes, pdfName, cancellationToken);
    }

    public async Task SendEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        byte[]? attachmentBytes = null,
        string? attachmentFileName = null,
        CancellationToken cancellationToken = default)
    {
        // ── Validate configuration ──
        if (string.IsNullOrWhiteSpace(_clientId) ||
            string.IsNullOrWhiteSpace(_clientSecret) ||
            string.IsNullOrWhiteSpace(_refreshToken))
        {
            Console.WriteLine("[GmailApiEmailService] ⚠️ Skipping: Gmail API OAuth credentials are not configured. " +
                              "Set GmailApi__ClientId, GmailApi__ClientSecret, and GmailApi__RefreshToken in Render.");
            _logger.LogWarning("Skipping email: Gmail API OAuth credentials not configured.");
            return;
        }

        if (string.IsNullOrWhiteSpace(_emailOptions.SenderEmail))
        {
            Console.WriteLine("[GmailApiEmailService] ⚠️ Skipping: SenderEmail not configured.");
            _logger.LogWarning("Skipping email: SenderEmail not configured.");
            return;
        }

        try
        {
            // ── Build MIME message using MimeKit ──
            var mimeMessage = new MimeMessage();
            var fromName = string.IsNullOrWhiteSpace(_emailOptions.SenderDisplayName)
                ? "Kalakaari Gift Shop"
                : _emailOptions.SenderDisplayName;

            mimeMessage.From.Add(new MailboxAddress(fromName, _emailOptions.SenderEmail));
            mimeMessage.To.Add(MailboxAddress.Parse(toEmail));
            mimeMessage.Subject = subject;

            var bodyBuilder = new BodyBuilder { HtmlBody = htmlBody };

            if (attachmentBytes is { Length: > 0 } && !string.IsNullOrWhiteSpace(attachmentFileName))
            {
                bodyBuilder.Attachments.Add(attachmentFileName, attachmentBytes,
                    ContentType.Parse("application/pdf"));
            }

            mimeMessage.Body = bodyBuilder.ToMessageBody();

            // ── Serialize the MIME message to a Base64Url-encoded string ──
            using var stream = new MemoryStream();
            await mimeMessage.WriteToAsync(stream, cancellationToken);
            var rawBytes = stream.ToArray();
            var base64Url = Convert.ToBase64String(rawBytes)
                .Replace('+', '-')
                .Replace('/', '_')
                .TrimEnd('=');

            // ── Create Gmail API service using the stored OAuth refresh token ──
            Console.WriteLine("[GmailApiEmailService] Creating Gmail API service with OAuth2 credentials...");

            var credential = new UserCredential(
                new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
                {
                    ClientSecrets = new ClientSecrets
                    {
                        ClientId = _clientId,
                        ClientSecret = _clientSecret
                    },
                    Scopes = [GmailService.Scope.GmailSend]
                }),
                "user",
                new TokenResponse { RefreshToken = _refreshToken }
            );

            // Force a token refresh to make sure the access token is valid
            Console.WriteLine("[GmailApiEmailService] Refreshing access token...");
            await credential.RefreshTokenAsync(cancellationToken);
            Console.WriteLine("[GmailApiEmailService] Access token refreshed successfully.");

            var gmailService = new GmailService(new BaseClientService.Initializer
            {
                HttpClientInitializer = credential,
                ApplicationName = "Kalakaari Gift Shop"
            });

            // ── Send the email via Gmail API ──
            Console.WriteLine($"[GmailApiEmailService] Sending email to {toEmail} (Subject: '{subject}')...");

            var gmailMessage = new Message { Raw = base64Url };
            await gmailService.Users.Messages.Send(gmailMessage, "me").ExecuteAsync(cancellationToken);

            Console.WriteLine($"[GmailApiEmailService] ✅ Email successfully sent to {toEmail}.");
            _logger.LogInformation("Email sent to {ToEmail} via Gmail API for subject '{Subject}'.", toEmail, subject);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GmailApiEmailService] ❌ Failed to send email to {toEmail}. Error: {ex.Message}");
            _logger.LogError(ex, "Failed to send email to {ToEmail} via Gmail API.", toEmail);
            throw;
        }
    }

    // ───────────────────────────────────────────────────────────
    //  HTML template (identical to MailKitEmailService)
    // ───────────────────────────────────────────────────────────

    private static string BuildOrderAlertHtml(Order order)
    {
        var sb = new StringBuilder();

        var paymentBadgeColor = order.PaymentMethod.ToString() == "UPI" ? "#854d0e" : "#1e40af";
        var paymentBadgeBg = order.PaymentMethod.ToString() == "UPI" ? "#fef9c3" : "#dbeafe";
        var dateFormatted = order.CreatedAt.ToLocalTime()
            .ToString("MMM dd, yyyy - hh:mm tt", CultureInfo.InvariantCulture);

        sb.Append($@"
<!DOCTYPE html>
<html>
<head>
  <meta charset=""utf-8"">
  <title>New Order #{order.PublicOrderNumber}</title>
</head>
<body style=""margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;"">
  <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""background-color: #f4f4f7; padding: 30px 10px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" width=""600"" style=""background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;"">
          
          <!-- Header Banner -->
          <tr>
            <td style=""background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 28px; text-align: center; color: #ffffff;"">
              <h1 style=""margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;"">🎉 New Order Placed!</h1>
              <p style=""margin: 8px 0 0; font-size: 15px; opacity: 0.9;"">Order Reference: <strong>{order.PublicOrderNumber}</strong></p>
            </td>
          </tr>

          <!-- Order Overview Info -->
          <tr>
            <td style=""padding: 24px 28px; border-bottom: 1px solid #f3f4f6;"">
              <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"">
                <tr>
                  <td style=""vertical-align: top; width: 50%;"">
                    <p style=""margin: 0; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600;"">Order Date</p>
                    <p style=""margin: 4px 0 0; font-size: 14px; font-weight: 500; color: #111827;"">{dateFormatted}</p>
                  </td>
                  <td style=""vertical-align: top; width: 50%; text-align: right;"">
                    <p style=""margin: 0; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600;"">Payment Method</p>
                    <p style=""margin: 4px 0 0;"">
                      <span style=""display: inline-block; background-color: {paymentBadgeBg}; color: {paymentBadgeColor}; padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600;"">
                        {order.PaymentMethod}
                      </span>
                    </p>
                  </td>
                </tr>
              </table>");

        if (!string.IsNullOrWhiteSpace(order.TransactionId))
        {
            sb.Append($@"
              <div style=""margin-top: 16px; padding: 12px 16px; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;"">
                <span style=""font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;"">UPI Transaction ID:</span>
                <span style=""font-family: monospace; font-size: 14px; font-weight: 700; color: #0f172a; margin-left: 8px;"">{order.TransactionId}</span>
              </div>");
        }

        sb.Append($@"
            </td>
          </tr>

          <!-- Customer Details -->
          <tr>
            <td style=""padding: 24px 28px; background-color: #fafafa; border-bottom: 1px solid #f3f4f6;"">
              <h2 style=""margin: 0 0 14px; font-size: 16px; color: #111827; font-weight: 600;"">👤 Customer Information</h2>
              <table role=""presentation"" width=""100%"" cellpadding=""4"" cellspacing=""0"" style=""font-size: 14px;"">
                <tr>
                  <td style=""width: 90px; color: #6b7280; font-weight: 500;"">Name:</td>
                  <td style=""color: #111827; font-weight: 600;"">{order.CustomerName}</td>
                </tr>
                <tr>
                  <td style=""color: #6b7280; font-weight: 500;"">Phone:</td>
                  <td><a href=""tel:{order.CustomerPhone}"" style=""color: #4f46e5; text-decoration: none; font-weight: 600;"">{order.CustomerPhone}</a></td>
                </tr>
                <tr>
                  <td style=""color: #6b7280; font-weight: 500; vertical-align: top;"">Address:</td>
                  <td style=""color: #111827; line-height: 1.4;"">{order.CustomerAddress}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items Ordered Table -->
          <tr>
            <td style=""padding: 24px 28px;"">
              <h2 style=""margin: 0 0 14px; font-size: 16px; color: #111827; font-weight: 600;"">📦 Items Ordered</h2>
              <table role=""presentation"" width=""100%"" cellpadding=""8"" cellspacing=""0"" style=""border-collapse: collapse; font-size: 14px;"">
                <thead>
                  <tr style=""background-color: #f9fafb; border-bottom: 2px solid #e5e7eb; text-align: left;"">
                    <th style=""padding: 10px; color: #4b5563; font-weight: 600;"">Item</th>
                    <th style=""padding: 10px; text-align: center; color: #4b5563; font-weight: 600;"">Qty</th>
                    <th style=""padding: 10px; text-align: right; color: #4b5563; font-weight: 600;"">Price</th>
                    <th style=""padding: 10px; text-align: right; color: #4b5563; font-weight: 600;"">Total</th>
                  </tr>
                </thead>
                <tbody>");

        foreach (var item in order.Items)
        {
            var lineTotal = item.PriceSnapshot * item.Quantity;
            sb.Append($@"
                  <tr style=""border-bottom: 1px solid #f3f4f6;"">
                    <td style=""padding: 10px; color: #111827; font-weight: 500;"">{item.TitleSnapshot}</td>
                    <td style=""padding: 10px; text-align: center; color: #4b5563;"">{item.Quantity}</td>
                    <td style=""padding: 10px; text-align: right; color: #4b5563;"">₹{item.PriceSnapshot:N2}</td>
                    <td style=""padding: 10px; text-align: right; font-weight: 600; color: #111827;"">₹{lineTotal:N2}</td>
                  </tr>");
        }

        var shippingDisplay = order.ShippingFee == 0
            ? "<span style='color: #16a34a; font-weight: 600;'>FREE</span>"
            : $"₹{order.ShippingFee:N2}";

        sb.Append($@"
                </tbody>
              </table>

              <!-- Financial Totals -->
              <table role=""presentation"" width=""100%"" cellpadding=""4"" cellspacing=""0"" style=""margin-top: 16px; font-size: 14px;"">
                <tr>
                  <td style=""text-align: right; color: #6b7280; width: 80%; padding: 4px 10px;"">Subtotal:</td>
                  <td style=""text-align: right; color: #111827; font-weight: 500; padding: 4px 10px;"">₹{order.Subtotal:N2}</td>
                </tr>
                <tr>
                  <td style=""text-align: right; color: #6b7280; padding: 4px 10px;"">Shipping:</td>
                  <td style=""text-align: right; padding: 4px 10px;"">{shippingDisplay}</td>
                </tr>
                <tr style=""border-top: 2px solid #e5e7eb;"">
                  <td style=""text-align: right; font-size: 16px; font-weight: 700; color: #111827; padding: 10px;"">Grand Total:</td>
                  <td style=""text-align: right; font-size: 18px; font-weight: 800; color: #4f46e5; padding: 10px;"">₹{order.TotalAmount:N2}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer / Note -->
          <tr>
            <td style=""background-color: #f9fafb; padding: 20px 28px; text-align: center; border-top: 1px solid #e5e7eb;"">
              <p style=""margin: 0; font-size: 13px; color: #6b7280;"">
                📎 <em>The official PDF invoice for this order is attached to this email.</em>
              </p>
              <p style=""margin: 8px 0 0; font-size: 12px; color: #9ca3af;"">
                Kalakaari Gift Shop Automation &bull; Sent automatically upon order placement
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>");

        return sb.ToString();
    }
}
