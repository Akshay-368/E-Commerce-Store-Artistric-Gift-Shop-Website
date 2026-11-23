# ─────────────────────────────────────────────────────────────────────────────
# GiftShop Backend — Dockerfile
# Place this file at:  Backend/Dockerfile
#
# Two-stage build:
#   Stage 1 (build)   — restores NuGet packages and publishes a self-contained
#                       release build of GiftShop.Api
#   Stage 2 (runtime) — copies only the published output into a slim ASP.NET
#                       runtime image; no SDK, no source code, smaller image
#
# .NET 10 Preview is used because the project targets net10.0.
# The mcr.microsoft.com/dotnet/nightly images are Microsoft's official
# nightly channel and are the correct images for .NET 10 until GA.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/nightly/sdk:10.0 AS build
WORKDIR /src

# Copy solution file first so the restore step can resolve all projects
COPY GiftShop.Backend.slnx ./

# Copy every project file before copying source — this lets Docker cache the
# NuGet restore layer and only re-run it when a .csproj actually changes,
# not on every source file change.
COPY GiftShop.Api/GiftShop.Api.csproj             GiftShop.Api/
COPY GiftShop.Infrastructure/GiftShop.Infrastructure.csproj  GiftShop.Infrastructure/
COPY GiftShop.Domain/GiftShop.Domain.csproj        GiftShop.Domain/
COPY GiftShop.Application/GiftShop.Application.csproj        GiftShop.Application/

# Restore all packages (cached layer)
RUN dotnet restore GiftShop.Backend.slnx

# Copy the full source code of every project
COPY GiftShop.Api/           GiftShop.Api/
COPY GiftShop.Infrastructure/ GiftShop.Infrastructure/
COPY GiftShop.Domain/         GiftShop.Domain/
COPY GiftShop.Application/    GiftShop.Application/

# Publish GiftShop.Api in Release mode
# --no-restore  — packages already restored above
# -o /app/publish — output directory for the published files
RUN dotnet publish GiftShop.Api/GiftShop.Api.csproj \
    --configuration Release \
    --no-restore \
    -o /app/publish

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/nightly/aspnet:10.0 AS runtime
WORKDIR /app

# Copy only the published output from the build stage — no SDK in final image
COPY --from=build /app/publish .

# Render (and most cloud hosts) set the PORT environment variable dynamically.
# ASP.NET Core reads ASPNETCORE_URLS to know which port to listen on.
# We set a default of 5000 here; Render will override PORT at runtime and
# our entrypoint script (below) forwards it to ASPNETCORE_URLS.
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_RUNNING_IN_CONTAINER=true

# Render injects PORT at runtime — this ensures ASP.NET Core listens on it
# regardless of what value Render picks (usually 10000 for web services).
# We use a shell form so the $PORT variable is expanded at runtime.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-5000} dotnet GiftShop.Api.dll"]
