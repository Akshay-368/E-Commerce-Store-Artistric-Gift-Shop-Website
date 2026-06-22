using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GiftShop.Infrastructure.Persistence.Migrations;

    /// <inheritdoc />
    public partial class MakeCategoryIdNullable : Migration
    {
        /// <inheritdoc />
        /* protected override void Up(MigrationBuilder migrationBuilder)
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
        } */

        
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Make CategoryId nullable using raw SQL with guards so this is
            // safe to re-run even if partially applied in a prior session.
            migrationBuilder.Sql(@"
                -- Drop the old NOT NULL FK if it still exists
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'FK_Products_Categories_CategoryId'
                          AND table_schema = 'public'
                    ) THEN
                        ALTER TABLE public.""Products"" DROP CONSTRAINT ""FK_Products_Categories_CategoryId"";
                    END IF;
                END $$;

                -- Make the column nullable (safe to run even if already nullable)
                ALTER TABLE public.""Products""
                    ALTER COLUMN ""CategoryId"" DROP NOT NULL;

                -- Clean up any Guid.Empty values that slipped through before this fix
                UPDATE public.""Products""
                    SET ""CategoryId"" = NULL
                    WHERE ""CategoryId"" = '00000000-0000-0000-0000-000000000000';

                -- Re-add FK with ON DELETE SET NULL
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'FK_Products_Categories_CategoryId'
                          AND table_schema = 'public'
                    ) THEN
                        ALTER TABLE public.""Products""
                            ADD CONSTRAINT ""FK_Products_Categories_CategoryId""
                            FOREIGN KEY (""CategoryId"")
                            REFERENCES public.""Categories""(""Id"")
                            ON DELETE SET NULL;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE public.""Products"" DROP CONSTRAINT IF EXISTS ""FK_Products_Categories_CategoryId"";

                ALTER TABLE public.""Products""
                    ALTER COLUMN ""CategoryId"" SET NOT NULL;

                ALTER TABLE public.""Products""
                    ADD CONSTRAINT ""FK_Products_Categories_CategoryId""
                    FOREIGN KEY (""CategoryId"")
                    REFERENCES public.""Categories""(""Id"")
                    ON DELETE RESTRICT;
            ");
        
        }
}

