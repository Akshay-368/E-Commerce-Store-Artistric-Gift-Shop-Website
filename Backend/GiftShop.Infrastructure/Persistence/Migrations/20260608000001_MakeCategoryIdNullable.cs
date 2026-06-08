using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GiftShop.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeCategoryIdNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Drop the old NOT NULL FK constraint
            migrationBuilder.DropForeignKey(
                name: "FK_Products_Categories_CategoryId",
                schema: "public",
                table: "Products");

            // Step 2: Make the column nullable
            migrationBuilder.AlterColumn<Guid>(
                name: "CategoryId",
                schema: "public",
                table: "Products",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: false);

            // Step 3: Set any existing Guid.Empty FK values to NULL
            // (cleans up any bad data that slipped through before this fix)
            migrationBuilder.Sql(
                "UPDATE public.\"Products\" SET \"CategoryId\" = NULL WHERE \"CategoryId\" = '00000000-0000-0000-0000-000000000000'");

            // Step 4: Re-add FK with ON DELETE SET NULL (so deleting a category doesn't block)
            migrationBuilder.AddForeignKey(
                name: "FK_Products_Categories_CategoryId",
                schema: "public",
                table: "Products",
                column: "CategoryId",
                principalSchema: "public",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Products_Categories_CategoryId",
                schema: "public",
                table: "Products");

            migrationBuilder.AlterColumn<Guid>(
                name: "CategoryId",
                schema: "public",
                table: "Products",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Categories_CategoryId",
                schema: "public",
                table: "Products",
                column: "CategoryId",
                principalSchema: "public",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}