using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using GiftShop.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GiftShop.Infrastructure.Services;

public interface ICloudinaryService
{
    Task<(string Url, string PublicId)> UploadProductImageAsync(Stream stream, string fileName);
    Task DeleteImageAsync(string publicId);
}

public sealed class CloudinaryService : ICloudinaryService
{
    private readonly Cloudinary _cloudinary;
    private readonly ILogger<CloudinaryService> _logger;

    

    public CloudinaryService(IOptions<CloudinarySettingsOptions> options, ILogger<CloudinaryService> logger)
    {
        var cfg = options.Value;
        var account = new Account(cfg.CloudName, cfg.ApiKey, cfg.ApiSecret);
        _cloudinary = new Cloudinary(account) { Api = { Secure = true } };
        _logger = logger;
    }

    public async Task<(string Url, string PublicId)> UploadProductImageAsync(Stream stream, string fileName)
    {
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(fileName, stream),
            // Enforce 2000px limit boundary exactly as specified
            Transformation = new Transformation().Width(2000).Crop("limit"),
            Folder = "products",
            UploadPreset = "giftopia_preset"
        };

        var result = await _cloudinary.UploadAsync(uploadParams);

        if (result.Error != null)
        {
            _logger.LogError("Cloudinary upload failed: {Error}", result.Error.Message);
            throw new InvalidOperationException($"Cloudinary upload failed: {result.Error.Message}");
        }

        _logger.LogInformation("Uploaded image to Cloudinary: {PublicId}", result.PublicId);
        return (result.SecureUrl.ToString(), result.PublicId);
    }

    public async Task DeleteImageAsync(string publicId)
    {
        var deleteParams = new DeletionParams(publicId);
        var result = await _cloudinary.DestroyAsync(deleteParams);
        if (result.Error != null)
            _logger.LogWarning("Cloudinary delete warning for {PublicId}: {Error}", publicId, result.Error.Message);
    }
}