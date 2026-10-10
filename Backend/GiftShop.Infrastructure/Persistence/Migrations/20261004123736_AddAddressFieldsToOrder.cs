using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GiftShop.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAddressFieldsToOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "City",
                schema: "public",
                table: "Orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Pincode",
                schema: "public",
                table: "Orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "State",
                schema: "public",
                table: "Orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "City",
                schema: "public",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Pincode",
                schema: "public",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "State",
                schema: "public",
                table: "Orders");
        }
    }
}
