using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GiftShop.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalImageUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add ExternalImageUrl column to SiteContentItems.
            // This allows seeding default section images (hero, feature-1, feature-2) using
            // public Unsplash/CDN URLs without requiring the admin to upload binary blobs.
            // When the admin uploads a proper image, BinaryValue is stored and takes priority.
            migrationBuilder.AddColumn<string>(
                name: "ExternalImageUrl",
                schema: "public",
                table: "SiteContentItems",
                type: "character varying(700)",
                maxLength: 700,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExternalImageUrl",
                schema: "public",
                table: "SiteContentItems");
        }
    }
}