ALTER TABLE "voice_sessions" ADD COLUMN "difficulty_level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD COLUMN "level_source" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD COLUMN "pre_session_anxiety" integer;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD COLUMN "post_session_anxiety" integer;