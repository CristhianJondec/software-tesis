CREATE TABLE "session_predictions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"expected_questions" text,
	"expected_topics" text DEFAULT '[]' NOT NULL,
	"feared_part" text,
	"feared_topic" text,
	"blank_outcome" text,
	"next_strategy" text,
	"strategy_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_predictions" ADD CONSTRAINT "session_predictions_session_id_voice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_predictions_session_idx" ON "session_predictions" USING btree ("session_id");