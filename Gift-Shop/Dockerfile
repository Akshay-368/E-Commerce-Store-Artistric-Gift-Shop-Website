# ─────────────────────────────────────────────────────────────────────────────
# GiftShop Frontend — Dockerfile
# Place this file at:  Gift-Shop/Dockerfile
#
# Two-stage build:
#   Stage 1 (build)   — installs npm dependencies and runs `ng build` which
#                       produces the Angular SSR output (browser + server bundles)
#   Stage 2 (runtime) — copies only the built dist folder into a slim Node image
#                       and runs the Express SSR server
#
# Angular 21 with SSR produces:
#   dist/Gift-Shop/browser/   — static assets (HTML, JS, CSS, images)
#   dist/Gift-Shop/server/    — Node/Express SSR server (server.mjs)
#
# The SSR server is started with:
#   node dist/Gift-Shop/server/server.mjs
# which maps to the `serve:ssr:Gift-Shop` script in package.json.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Copy package files first so npm install is cached separately from source
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for ng build)
# --frozen-lockfile ensures the exact versions from package-lock.json are used
RUN npm ci

# Copy the full Angular source code
COPY . .

# Run the Angular production build
# This compiles TypeScript, bundles, tree-shakes, and produces the SSR output
# The output lands in dist/Gift-Shop/browser/ and dist/Gift-Shop/server/
RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Copy only the compiled dist output — no source, no node_modules from build
COPY --from=build /app/dist ./dist

# Copy package.json so we can install only production dependencies
# The SSR server (Express) needs runtime deps from node_modules
COPY package.json package-lock.json ./

# Install only production dependencies for the runtime image
# devDependencies (Angular CLI, TypeScript compiler etc.) are excluded
RUN npm ci --omit=dev

# The Angular SSR server reads PORT from the environment.
# Render sets PORT dynamically (usually 10000). Default to 4000 locally.
ENV PORT=4000
ENV NODE_ENV=production

# BACKEND_URL is the full URL of your deployed .NET backend on Render.
# This is read by the Angular SSR server when it makes server-side HTTP calls.
# Set this in Render's environment variables dashboard:
#   BACKEND_URL = https://your-backend-service.onrender.com
ENV BACKEND_URL=http://localhost:5000

# Expose the port (documentation only — Render uses PORT env var)
EXPOSE 4000

# Start the Angular SSR Express server
CMD ["node", "dist/Gift-Shop/server/server.mjs"]
