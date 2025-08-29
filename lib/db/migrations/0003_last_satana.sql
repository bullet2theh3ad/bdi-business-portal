ALTER TABLE "teams" ADD COLUMN "home_location_name" varchar(200);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "home_latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "home_longitude" numeric(10, 7);