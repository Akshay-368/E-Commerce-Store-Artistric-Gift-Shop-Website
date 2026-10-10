using GiftShop.Domain.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace GiftShop.Infrastructure.Services;

public sealed class PdfInvoiceService : IPdfInvoiceService
{
    public byte[] GenerateInvoice(Order order)
    {
        // QuestPDF license type (community free)
        QuestPDF.Settings.License = LicenseType.Community;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(10));

                // Header
                page.Header().Element(c => c
                    .Row(row =>
                    {
                        row.RelativeItem().Column(headerLeft =>
                        {
                            headerLeft.Item().Text("Kalakaari Gifting")
                                .FontSize(20).Bold().FontColor(Colors.Grey.Darken3);
                            headerLeft.Item().Text("Handcrafted with love")
                                .FontSize(10).FontColor(Colors.Grey.Darken1);
                        });
                        row.ConstantItem(120).Column(headerRight =>
                        {
                            headerRight.Item().Text($"Invoice # {order.PublicOrderNumber}")
                                .FontSize(14).Bold();
                            headerRight.Item().Text($"Date: {order.CreatedAt:dd MMM yyyy}");
                            headerRight.Item().Text($"Status: {order.Status}");
                        });
                    }));

                // Customer info
                page.Content().PaddingVertical(20).Column(content =>
                {
                    content.Item().Text("Bill To:").Bold();
                    content.Item().Text(order.CustomerName);
                    content.Item().Text(order.CustomerAddress);
                    content.Item().Text($"Phone: {order.CustomerPhone}");
                    if (!string.IsNullOrEmpty(order.TransactionId))
                        content.Item().Text($"Transaction ID: {order.TransactionId}");

                    content.Item().PaddingVertical(15);

                    // Items table
                    content.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(4); // Product
                            columns.RelativeColumn(1); // Qty
                            columns.RelativeColumn(2); // Price
                            columns.RelativeColumn(2); // Total
                        });

                        // Header
                        table.Header(header =>
                        {
                            header.Cell().Text("Product").Bold();
                            header.Cell().AlignRight().Text("Qty").Bold();
                            header.Cell().AlignRight().Text("Price").Bold();
                            header.Cell().AlignRight().Text("Total").Bold();
                        });

                        foreach (var item in order.Items)
                        {
                            table.Cell().Text(item.TitleSnapshot);
                            table.Cell().AlignRight().Text(item.Quantity.ToString());
                            table.Cell().AlignRight().Text($"₹{item.PriceSnapshot:N2}");
                            table.Cell().AlignRight().Text($"₹{item.PriceSnapshot * item.Quantity:N2}");
                        }
                    });

                    // Totals
                    content.Item().PaddingTop(10).Row(row =>
                    {
                        row.RelativeItem().AlignRight().PaddingRight(10).Text("Subtotal:");
                        row.ConstantItem(80).AlignRight().Text($"₹{order.Subtotal:N2}");
                    });
                    content.Item().Row(row =>
                    {
                        row.RelativeItem().AlignRight().PaddingRight(10).Text("Shipping:");
                        row.ConstantItem(80).AlignRight().Text($"₹{order.ShippingFee:N2}");
                    });
                    content.Item().Row(row =>
                    {
                        row.RelativeItem().AlignRight().PaddingRight(10).Text("Total:").Bold();
                        row.ConstantItem(80).AlignRight().Text($"₹{order.TotalAmount:N2}").Bold();
                    });
                });

                // Footer
                page.Footer().AlignCenter().Text("Thank you for supporting handmade art!")
                    .FontSize(9).Italic().FontColor(Colors.Grey.Medium);
            });
        });

        return document.GeneratePdf();
    }
}