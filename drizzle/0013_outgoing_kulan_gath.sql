ALTER TABLE "users" ADD COLUMN "thesis_upload_limit" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "thesis_uploads" integer DEFAULT 0 NOT NULL;