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
            /* migrationBuilder.AddColumn<string>(
                name: "ExternalImageUrl",
                schema: "public",
                table: "SiteContentItems",
                type: "character varying(700)",
                maxLength: 700,
                nullable: true); */
            
            // Uses raw SQL with IF NOT EXISTS so this migration is safe to apply
            // even if the column was already created by the defensive guard in Program.cs.
            migrationBuilder.Sql(@"
                ALTER TABLE public.""SiteContentItems""
                    ADD COLUMN IF NOT EXISTS ""ExternalImageUrl"" character varying(700) NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* migrationBuilder.DropColumn(
                name: "ExternalImageUrl",
                schema: "public",
                table: "SiteContentItems"); */
            
            migrationBuilder.Sql(@"
                ALTER TABLE public.""SiteContentItems""
                    DROP COLUMN IF EXISTS ""ExternalImageUrl"";
            ");
        }
    }
}