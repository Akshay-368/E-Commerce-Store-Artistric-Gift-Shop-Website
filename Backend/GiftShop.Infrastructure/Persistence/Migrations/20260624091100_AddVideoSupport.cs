using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GiftShop.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVideoSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "VideoPublicId",
                schema: "public",
                table: "SiteContentItems",
                type: "character varying(240)",
                maxLength: 240,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VideoUrl",
                schema: "public",
                table: "SiteContentItems",
                type: "character varying(700)",
                maxLength: 700,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VideoPublicId",
                schema: "public",
                table: "Products",
                type: "character varying(240)",
                maxLength: 240,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VideoUrl",
                schema: "public",
                table: "Products",
                type: "character varying(700)",
                maxLength: 700,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "VideoPublicId",
                schema: "public",
                table: "SiteContentItems");

            migrationBuilder.DropColumn(
                name: "VideoUrl",
                schema: "public",
                table: "SiteContentItems");

            migrationBuilder.DropColumn(
                name: "VideoPublicId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "VideoUrl",
                schema: "public",
                table: "Products");
        }
    }
}
