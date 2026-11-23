using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using GiftShop.Domain.Entities;
using GiftShop.Domain.Enums;
using GiftShop.Infrastructure.Options;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GiftShop.Infrastructure.Services;

public class ShiprocketService : IShiprocketService
{
    private readonly HttpClient _httpClient;
    private readonly ShiprocketSettingsOptions _options;
    private readonly ILogger<ShiprocketService> _logger;
    private readonly IConfiguration _configuration;

    private static string? _cachedToken;
    private static DateTime _tokenExpiry;

    public ShiprocketService(
        HttpClient httpClient, 
        IOptions<ShiprocketSettingsOptions> options, 
        ILogger<ShiprocketService> logger,
        IConfiguration configuration)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
        _configuration = configuration;
    }

    private async Task<string?> GetTokenAsync()
    {
        if (!string.IsNullOrEmpty(_cachedToken) && DateTime.UtcNow < _tokenExpiry)
        {
            return _cachedToken;
        }

        if (string.IsNullOrWhiteSpace(_options.Email) || string.IsNullOrWhiteSpace(_options.Password))
        {
            _logger.LogWarning("[Shiprocket] Missing Email or Password in configuration.");
            return null;
        }

        var loginPayload = new { email = _options.Email, password = _options.Password };
        var response = await _httpClient.PostAsJsonAsync("https://apiv2.shiprocket.in/v1/external/auth/login", loginPayload);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("[Shiprocket] Auth failed: {Status} {Error}", response.StatusCode, await response.Content.ReadAsStringAsync());
            return null;
        }

        var content = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(content);
        if (doc.RootElement.TryGetProperty("token", out var tokenProp))
        {
            _cachedToken = tokenProp.GetString();
            _tokenExpiry = DateTime.UtcNow.AddDays(9); // Shiprocket tokens are valid for 10 days
            return _cachedToken;
        }
        return null;
    }

    public async Task<decimal?> EstimateShippingAsync(string deliveryPincode, decimal weightKg, int cod, decimal declaredValue = 0, string? pickupPincode = null)
    {
        var token = await GetTokenAsync();
        if (string.IsNullOrEmpty(token)) return null;

        if (string.IsNullOrWhiteSpace(pickupPincode))
        {
            var envPickup = _configuration["Shiprocket:PickupPincode"] ?? _configuration["ShiprocketSettings:PickupPincode"];
            if (!string.IsNullOrWhiteSpace(envPickup))
            {
                pickupPincode = envPickup.Trim();
            }
            else if (!string.IsNullOrWhiteSpace(_options.PickupPincode) && _options.PickupPincode != "110001")
            {
                pickupPincode = _options.PickupPincode.Trim();
            }
            else
            {
                pickupPincode = "247776";
            }
        }

        weightKg = Math.Max(0.05m, weightKg);

        var url = $"https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode={pickupPincode}&delivery_postcode={deliveryPincode}&weight={weightKg}&cod={cod}&declared_value={declaredValue}&is_return=0";
        
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        try 
        {
            var response = await _httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[Shiprocket] Serviceability failed: {Status} {Content}", response.StatusCode, content);
                return null;
            }

            using var doc = JsonDocument.Parse(content);
            
            if (doc.RootElement.TryGetProperty("data", out var data) && 
                data.TryGetProperty("available_courier_companies", out var couriers) && 
                couriers.ValueKind == JsonValueKind.Array &&
                couriers.GetArrayLength() > 0)
            {
                var courierList = new System.Collections.Generic.List<(string Name, decimal Rate, bool IsSurface, bool IsRecommended, double Rating)>();

                foreach (var courier in couriers.EnumerateArray())
                {
                    decimal rateVal = 0;
                    if (courier.TryGetProperty("rate", out var rateProp) && rateProp.TryGetDouble(out var rate))
                    {
                        rateVal = (decimal)rate;
                    }
                    else if (courier.TryGetProperty("freight_charge", out var freightProp) && freightProp.TryGetDouble(out var freight))
                    {
                        rateVal = (decimal)freight;
                    }

                    if (rateVal <= 0) continue;

                    // Add Shiprocket surcharges (Auto-Secure Insurance, WhatsApp alerts, other surcharges)
                    decimal coverageCharges = 0;
                    if (courier.TryGetProperty("coverage_charges", out var covProp) && covProp.TryGetDouble(out var cov))
                    {
                        coverageCharges = (decimal)cov;
                    }

                    decimal whatsappCharges = 0;
                    if (courier.TryGetProperty("whatsapp_charges", out var waProp) && waProp.TryGetDouble(out var wa))
                    {
                        whatsappCharges = (decimal)wa;
                    }

                    decimal otherCharges = 0;
                    if (courier.TryGetProperty("other_charges", out var othProp) && othProp.TryGetDouble(out var oth))
                    {
                        otherCharges = (decimal)oth;
                    }

                    decimal totalCourierRate = rateVal + coverageCharges + whatsappCharges + otherCharges;

                    string name = courier.TryGetProperty("courier_name", out var nameProp) ? (nameProp.GetString() ?? "") : "";

                    bool isAir = name.Contains("Air", StringComparison.OrdinalIgnoreCase);
                    bool isSurface = !isAir;

                    if (courier.TryGetProperty("is_surface", out var surfaceProp))
                    {
                        if (surfaceProp.ValueKind == JsonValueKind.True) isSurface = true;
                        else if (surfaceProp.ValueKind == JsonValueKind.False) isSurface = false;
                        else if (surfaceProp.ValueKind == JsonValueKind.Number && surfaceProp.GetInt32() == 1) isSurface = true;
                    }
                    else if (courier.TryGetProperty("mode", out var modeProp))
                    {
                        if (modeProp.ValueKind == JsonValueKind.String && modeProp.GetString()?.Contains("surface", StringComparison.OrdinalIgnoreCase) == true) isSurface = true;
                        else if (modeProp.ValueKind == JsonValueKind.Number && modeProp.GetInt32() == 1) isSurface = true;
                    }

                    bool isRecommended = false;
                    if (courier.TryGetProperty("is_recommended", out var recProp))
                    {
                        if (recProp.ValueKind == JsonValueKind.True || (recProp.ValueKind == JsonValueKind.Number && recProp.GetInt32() == 1))
                            isRecommended = true;
                    }
                    else if (courier.TryGetProperty("recommendation_score", out var scoreProp) && scoreProp.TryGetDouble(out var score) && score > 0)
                    {
                        isRecommended = true;
                    }

                    double rating = 0;
                    if (courier.TryGetProperty("rating", out var ratProp) && ratProp.TryGetDouble(out var r))
                        rating = r;
                    else if (courier.TryGetProperty("courier_rating", out var cRatProp) && cRatProp.TryGetDouble(out var cr))
                        rating = cr;

                    courierList.Add((name, totalCourierRate, isSurface, isRecommended, rating));
                }

                if (courierList.Count > 0)
                {
                    // Pick the highest-priced serviceable courier partner to guarantee the store owner never faces a loss
                    var selected = courierList.OrderByDescending(c => c.Rate).First();

                    _logger.LogInformation("[Shiprocket] Picked highest-rate courier {Name} at total rate ₹{Rate} (from {Total} available couriers, pickup {Pickup})", selected.Name, selected.Rate, courierList.Count, pickupPincode);
                    return selected.Rate;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Shiprocket] Failed to parse serviceability response or network error.");
        }

        return null;
    }

    public async Task<string> CreateOrderAsync(Order order)
    {
        var token = await GetTokenAsync();
        if (string.IsNullOrEmpty(token))
            throw new Exception("Shiprocket authentication failed or credentials not configured.");

        // Try to split name
        var nameParts = order.CustomerName.Trim().Split(' ', 2);
        var firstName = nameParts.Length > 0 ? nameParts[0] : "Customer";
        var lastName = nameParts.Length > 1 ? nameParts[1] : ".";

        // Aggregate Dimensions
        decimal totalWeightGrams = 0;
        decimal maxLength = 10, maxWidth = 10, maxHeight = 10; // Default min dims

        var orderItems = new System.Collections.Generic.List<object>();
        foreach (var item in order.Items)
        {
            var w = item.Product?.WeightGrams ?? 100m;
            totalWeightGrams += w * item.Quantity;
            
            maxLength = Math.Max(maxLength, item.Product?.LengthCm ?? 10m);
            maxWidth = Math.Max(maxWidth, item.Product?.WidthCm ?? 10m);
            maxHeight = Math.Max(maxHeight, item.Product?.HeightCm ?? 10m);

            orderItems.Add(new
            {
                name = item.TitleSnapshot,
                sku = item.ProductId.ToString().Substring(0, 8),
                units = item.Quantity,
                selling_price = item.PriceSnapshot,
                discount = "",
                tax = "",
                hsn = ""
            });
        }

        var weightKg = Math.Max(0.05m, totalWeightGrams / 1000m); // Min 50 grams

        var payload = new
        {
            order_id = order.PublicOrderNumber,
            order_date = order.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            pickup_location = _options.PickupLocation,
            billing_customer_name = firstName,
            billing_last_name = lastName,
            billing_address = order.CustomerAddress,
            billing_city = order.City,
            billing_pincode = order.Pincode,
            billing_state = order.State,
            billing_country = "India",
            billing_email = order.CustomerEmail,
            billing_phone = order.CustomerPhone,
            shipping_is_billing = true,
            order_items = orderItems,
            payment_method = "Prepaid",
            sub_total = order.Subtotal,
            length = maxLength,
            breadth = maxWidth,
            height = maxHeight,
            weight = weightKg
        };

        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _httpClient.PostAsJsonAsync("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", payload);
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("[Shiprocket] CreateOrder failed: {Status} {Error}", response.StatusCode, content);
            throw new Exception($"Shiprocket API error: {content}");
        }

        using var doc = JsonDocument.Parse(content);
        // Shiprocket returns shipment_id, order_id, awb_code, routing_code, etc.
        if (doc.RootElement.TryGetProperty("awb_code", out var awbProp) && awbProp.ValueKind == JsonValueKind.String)
        {
            return awbProp.GetString() ?? "PENDING_AWB";
        }
        
        if (doc.RootElement.TryGetProperty("shipment_id", out var shipmentProp))
        {
            // If awb is not generated synchronously, they return shipment_id. We can use it as tracking number for now.
            return shipmentProp.GetInt32().ToString();
        }

        return "UNKNOWN_TRACKING";
    }
}
