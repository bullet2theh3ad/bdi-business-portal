-- Add extended user profile fields
ALTER TABLE "users" ADD COLUMN "phone" varchar(20);
ALTER TABLE "users" ADD COLUMN "avatar_url" text;
ALTER TABLE "users" ADD COLUMN "emergency_contact_name" varchar(100);
ALTER TABLE "users" ADD COLUMN "emergency_contact_email" varchar(255);
ALTER TABLE "users" ADD COLUMN "emergency_contact_phone" varchar(20);
ALTER TABLE "users" ADD COLUMN "allergies" text;
ALTER TABLE "users" ADD COLUMN "team_display_name" varchar(100);