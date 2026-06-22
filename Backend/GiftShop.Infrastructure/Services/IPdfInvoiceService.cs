using GiftShop.Domain.Entities;

namespace GiftShop.Infrastructure.Services;

public interface IPdfInvoiceService
{
    byte[] GenerateInvoice(Order order);
}