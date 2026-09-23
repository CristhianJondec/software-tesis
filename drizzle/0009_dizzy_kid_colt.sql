CREATE TABLE "session_closings" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"spoken_text" text NOT NULL,
	"evidence" text DEFAULT '[]' NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"generator_version" text NOT NULL,
	"spoken_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_closings" ADD CONSTRAINT "session_closings_session_id_voice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_closings_session_idx" ON "session_closings" USING btree ("session_id");