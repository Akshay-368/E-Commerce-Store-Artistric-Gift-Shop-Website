using System.Threading.Tasks;
using GiftShop.Domain.Entities;

namespace GiftShop.Infrastructure.Services;

public interface IShiprocketService
{
    Task<string> CreateOrderAsync(Order order);
    Task<decimal?> EstimateShippingAsync(string deliveryPincode, decimal weightKg, int cod);
}
