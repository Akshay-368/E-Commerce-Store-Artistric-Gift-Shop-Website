SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

-- Core Catalog Tables (Check Categories to find a valid GUID for your product insert!)
SELECT * FROM public."Categories";
SELECT * FROM public."Products";
SELECT * FROM public."ProductImages";

-- User & Administration Tables
SELECT * FROM public."AdminUsers";
SELECT * FROM public."AdminAccessBans";

-- Site Content & Settings
SELECT * FROM public."SiteContentItems";

-- Order Management Lifecycle
SELECT * FROM public."Orders";
SELECT * FROM public."OrderItems";
SELECT * FROM public."OrderMessages";

-- Customer Feedback & System History
SELECT * FROM public."Reviews";
SELECT * FROM public."SystemAuditLogs";
SELECT * FROM public."__EFMigrationsHistory";