using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GiftShop.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddShippingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "HeightCm",
                schema: "public",
                table: "Products",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LengthCm",
                schema: "public",
                table: "Products",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "WeightGrams",
                schema: "public",
                table: "Products",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "WidthCm",
                schema: "public",
                table: "Products",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CourierName",
                schema: "public",
                table: "Orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingStatus",
                schema: "public",
                table: "Orders",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrackingNumber",
                schema: "public",
                table: "Orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrackingUrl",
                schema: "public",
                table: "Orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HeightCm",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "LengthCm",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "WeightGrams",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "WidthCm",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "CourierName",
                schema: "public",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ShippingStatus",
                schema: "public",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "TrackingNumber",
                schema: "public",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "TrackingUrl",
                schema: "public",
                table: "Orders");
        }
    }
}
