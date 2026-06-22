using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GiftShop.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDashboardActivityFieldsInSystemAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: "public",
                table: "SystemAuditLogs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ForwardedFor",
                schema: "public",
                table: "SystemAuditLogs",
                type: "character varying(45)",
                maxLength: 45,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RemoteIpAddress",
                schema: "public",
                table: "SystemAuditLogs",
                type: "character varying(45)",
                maxLength: 45,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserAgent",
                schema: "public",
                table: "SystemAuditLogs",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                schema: "public",
                table: "SystemAuditLogs");

            migrationBuilder.DropColumn(
                name: "ForwardedFor",
                schema: "public",
                table: "SystemAuditLogs");

            migrationBuilder.DropColumn(
                name: "RemoteIpAddress",
                schema: "public",
                table: "SystemAuditLogs");

            migrationBuilder.DropColumn(
                name: "UserAgent",
                schema: "public",
                table: "SystemAuditLogs");
        }
    }
}
