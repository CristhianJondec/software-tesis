CREATE TABLE "turn_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"turn_id" text NOT NULL,
	"prompt_version" text NOT NULL,
	"content_level" integer,
	"content_justification" text,
	"content_segment_id" text,
	"clarity_level" integer,
	"clarity_justification" text,
	"detail" text,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_turns" ADD COLUMN "max_pause_ms" integer;--> statement-breakpoint
ALTER TABLE "turn_feedback" ADD CONSTRAINT "turn_feedback_turn_id_session_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."session_turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_feedback" ADD CONSTRAINT "turn_feedback_content_segment_id_book_segments_id_fk" FOREIGN KEY ("content_segment_id") REFERENCES "public"."book_segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "turn_feedback_turn_version_idx" ON "turn_feedback" USING btree ("turn_id","prompt_version");--> statement-breakpoint
CREATE INDEX "turn_feedback_version_idx" ON "turn_feedback" USING btree ("prompt_version");