namespace GiftShop.Infrastructure.Options;

public class ShiprocketSettingsOptions
{
    public const string SectionName = "ShiprocketSettings";
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string PickupLocation { get; set; } = string.Empty;
    public string PickupPincode { get; set; } = string.Empty;
}
