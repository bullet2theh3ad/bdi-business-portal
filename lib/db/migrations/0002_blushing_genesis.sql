ALTER TABLE "users" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emergency_contact_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emergency_contact_email" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emergency_contact_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allergies" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "team_display_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token_expiry" timestamp;