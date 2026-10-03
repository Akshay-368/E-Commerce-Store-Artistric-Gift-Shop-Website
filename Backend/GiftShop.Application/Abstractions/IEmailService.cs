using GiftShop.Domain.Entities;

namespace GiftShop.Application.Abstractions;

public interface IEmailService
{
    /// <summary>
    /// Sends a detailed order notification email to the owner's personal email address,
    /// complete with customer details, order item breakdown, totals, payment method,
    /// and optionally the generated PDF invoice.
    /// </summary>
    Task SendNewOrderAlertToOwnerAsync(Order order, CancellationToken cancellationToken = default);

    /// <summary>
    /// Generic helper to send an HTML email with optional attachment.
    /// </summary>
    Task SendEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        byte[]? attachmentBytes = null,
        string? attachmentFileName = null,
        CancellationToken cancellationToken = default);
}
