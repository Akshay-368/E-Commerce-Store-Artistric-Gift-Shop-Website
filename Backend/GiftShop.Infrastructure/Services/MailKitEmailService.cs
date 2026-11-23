using System.Globalization;
using System.Text;
using GiftShop.Application.Abstractions;
using GiftShop.Domain.Entities;
using GiftShop.Infrastructure.Options;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace GiftShop.Infrastructure.Services;

public sealed class MailKitEmailService : IEmailService
{
    private readonly EmailSettingsOptions _options;
    private readonly IPdfInvoiceService _pdfInvoiceService;
    private readonly ILogger<MailKitEmailService> _logger;

    public MailKitEmailService(
        IOptions<EmailSettingsOptions> options,
        IConfiguration configuration,
        IPdfInvoiceService pdfInvoiceService,
        ILogger<MailKitEmailService> logger)
    {
        _pdfInvoiceService = pdfInvoiceService;
        _logger = logger;

        // Populate options with fallback to environment variables
        var opts = options.Value ?? new EmailSettingsOptions();

        opts.OwnerEmail = ResolveValue(opts.OwnerEmail, "EmailSettings:OwnerEmail", "EmailSettings__OwnerEmail", "OWNER_EMAIL", "Smtp:OwnerEmail", "Smtp__OwnerEmail")?.Trim() ?? string.Empty;
        opts.SenderEmail = ResolveValue(opts.SenderEmail, "EmailSettings:SenderEmail", "EmailSettings__SenderEmail", "SENDER_EMAIL", "Smtp:Username", "Smtp__Username", "Smtp:FromEmail", "Smtp__FromEmail")?.Trim() ?? string.Empty;
        opts.SenderPassword = (ResolveValue(opts.SenderPassword, "EmailSettings:SenderPassword", "EmailSettings__SenderPassword", "SENDER_PASSWORD", "Smtp:Password", "Smtp__Password") ?? string.Empty)
            .Replace(" ", "").Trim();
        opts.SmtpHost = ResolveValue(opts.SmtpHost, "EmailSettings:SmtpHost", "EmailSettings__SmtpHost", "SMTP_HOST", "Smtp:Host", "Smtp__Host")?.Trim() ?? "smtp.gmail.com";

        var portStr = configuration["EmailSettings:SmtpPort"]
                      ?? Environment.GetEnvironmentVariable("EmailSettings__SmtpPort")
                      ?? configuration["Smtp:Port"]
                      ?? Environment.GetEnvironmentVariable("Smtp__Port")
                      ?? Environment.GetEnvironmentVariable("SMTP_PORT");
        if (int.TryParse(portStr, out var port))
        {
            opts.SmtpPort = port;
        }

        _options = opts;

        string ResolveValue(string current, params string[] configKeys)
        {
            foreach (var key in configKeys)
            {
                var val = configuration[key] ?? Environment.GetEnvironmentVariable(key);
                if (!string.IsNullOrWhiteSpace(val) && !IsPlaceholder(val))
                    return val;
            }

            if (!string.IsNullOrWhiteSpace(current) && !IsPlaceholder(current))
                return current;

            return current;
        }

        bool IsPlaceholder(string val)
        {
            return val.Contains("your-personal-email", StringComparison.OrdinalIgnoreCase)
                || val.Contains("your-gmail-app-password", StringComparison.OrdinalIgnoreCase)
                || val.Equals("kalakaari.shop@gmail.com", StringComparison.OrdinalIgnoreCase);
        }
    }

    public async Task SendNewOrderAlertToOwnerAsync(Order order, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[EmailService] Processing order alert email for order {order.PublicOrderNumber}...");

        if (string.IsNullOrWhiteSpace(_options.OwnerEmail) || _options.OwnerEmail.Contains("your-personal-email"))
        {
            Console.WriteLine($"[EmailService] ⚠️ Skipping: OwnerEmail is not configured (current='{_options.OwnerEmail}'). Set EmailSettings__OwnerEmail in Render.");
            _logger.LogWarning("Skipping order alert email: Owner email is not configured in EmailSettings (set EmailSettings__OwnerEmail in .env).");
            return;
        }

        var subject = $"🛒 New Order Received: {order.PublicOrderNumber} - ₹{order.TotalAmount:N2}";
        var htmlBody = BuildOrderAlertHtml(order);

        byte[]? pdfInvoiceBytes = null;
        string? pdfFileName = null;

        try
        {
            pdfInvoiceBytes = _pdfInvoiceService.GenerateInvoice(order);
            pdfFileName = $"Invoice-{order.PublicOrderNumber}.pdf";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[EmailService] ⚠️ Could not generate PDF invoice attachment: {ex.Message}. Sending email without attachment.");
            _logger.LogWarning(ex, "Could not generate PDF invoice attachment for order {OrderNumber}. Sending email without attachment.", order.PublicOrderNumber);
        }

        await SendEmailAsync(_options.OwnerEmail, subject, htmlBody, pdfInvoiceBytes, pdfFileName, cancellationToken);
    }

    public async Task SendEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        byte[]? attachmentBytes = null,
        string? attachmentFileName = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.SenderEmail) || string.IsNullOrWhiteSpace(_options.SenderPassword) ||
            _options.SenderEmail.Contains("kalakaari.shop@gmail.com") || _options.SenderPassword.Contains("your-gmail-app-password"))
        {
            Console.WriteLine($"[EmailService] ⚠️ Skipping: SenderEmail or SenderPassword is not configured. (SenderEmail='{_options.SenderEmail}', HasPassword={!string.IsNullOrWhiteSpace(_options.SenderPassword)}). Set EmailSettings__SenderEmail and EmailSettings__SenderPassword in Render.");
            _logger.LogWarning(
                "Skipping email dispatch: Sender email or password is not configured in EmailSettings (set EmailSettings__SenderEmail and EmailSettings__SenderPassword in .env or appsettings.json).");
            return;
        }

        try
        {
            var message = new MimeMessage();
            var fromName = string.IsNullOrWhiteSpace(_options.SenderDisplayName) ? "Kalakaari Gift Shop" : _options.SenderDisplayName;
            message.From.Add(new MailboxAddress(fromName, _options.SenderEmail));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;

            var builder = new BodyBuilder
            {
                HtmlBody = htmlBody
            };

            if (attachmentBytes != null && attachmentBytes.Length > 0 && !string.IsNullOrWhiteSpace(attachmentFileName))
            {
                builder.Attachments.Add(attachmentFileName, attachmentBytes, ContentType.Parse("application/pdf"));
            }

            message.Body = builder.ToMessageBody();

            using var client = new SmtpClient();
            // Disable certificate revocation checks to prevent Linux container TLS handshake hangs
            client.CheckCertificateRevocation = false;
            client.Timeout = 15000;

            // Configure socket security
            var socketOptions = _options.SmtpPort switch
            {
                465 => SecureSocketOptions.SslOnConnect,
                587 => SecureSocketOptions.StartTls,
                _ => _options.EnableSsl ? SecureSocketOptions.Auto : SecureSocketOptions.None
            };

            try
            {
                Console.WriteLine($"[EmailService] Connecting to SMTP {_options.SmtpHost}:{_options.SmtpPort} as {_options.SenderEmail} (Security: {socketOptions})...");
                await client.ConnectAsync(_options.SmtpHost, _options.SmtpPort, socketOptions, cancellationToken);
            }
            catch (Exception connectEx) when (_options.SmtpPort == 587)
            {
                Console.WriteLine($"[EmailService] ⚠️ Port 587 connection failed ({connectEx.Message}). Retrying with SSL on port 465...");
                await client.ConnectAsync(_options.SmtpHost, 465, SecureSocketOptions.SslOnConnect, cancellationToken);
            }

            Console.WriteLine($"[EmailService] Connected! Authenticating as {_options.SenderEmail}...");
            await client.AuthenticateAsync(_options.SenderEmail, _options.SenderPassword, cancellationToken);

            Console.WriteLine($"[EmailService] Authenticated! Sending message (Subject: '{subject}')...");
            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);

            Console.WriteLine($"[EmailService] ✅ Email successfully delivered to {toEmail} for subject '{subject}'.");
            _logger.LogInformation("Order notification email successfully sent to {OwnerEmail} for subject '{Subject}'.", toEmail, subject);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[EmailService] ❌ Failed to send email to {toEmail} via SMTP {_options.SmtpHost}:{_options.SmtpPort}. Error: {ex.Message}");
            _logger.LogError(ex, "Failed to send email to {ToEmail} with subject '{Subject}' via SMTP {Host}:{Port}.", toEmail, subject, _options.SmtpHost, _options.SmtpPort);
            throw;
        }
    }

    private static string BuildOrderAlertHtml(Order order)
    {
        var sb = new StringBuilder();

        var paymentBadgeColor = order.PaymentMethod.ToString() == "UPI" ? "#854d0e" : "#1e40af";
        var paymentBadgeBg = order.PaymentMethod.ToString() == "UPI" ? "#fef9c3" : "#dbeafe";
        var dateFormatted = order.CreatedAt.ToLocalTime().ToString("MMM dd, yyyy - hh:mm tt", CultureInfo.InvariantCulture);

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

        var shippingDisplay = order.ShippingFee == 0 ? "<span style='color: #16a34a; font-weight: 600;'>FREE</span>" : $"₹{order.ShippingFee:N2}";

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
