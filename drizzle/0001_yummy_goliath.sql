CREATE TABLE "session_turns" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"turn_index" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp NOT NULL,
	"student_latency_ms" integer,
	"system_latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turn_retrievals" (
	"id" text PRIMARY KEY NOT NULL,
	"turn_id" text,
	"session_id" text,
	"segment_id" text NOT NULL,
	"query" text NOT NULL,
	"rank" integer NOT NULL,
	"distance" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "participant_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "study_group" text;--> statement-breakpoint
ALTER TABLE "session_turns" ADD CONSTRAINT "session_turns_session_id_voice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_retrievals" ADD CONSTRAINT "turn_retrievals_turn_id_session_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."session_turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_retrievals" ADD CONSTRAINT "turn_retrievals_session_id_voice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_retrievals" ADD CONSTRAINT "turn_retrievals_segment_id_book_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."book_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_turns_session_turn_idx" ON "session_turns" USING btree ("session_id","turn_index");--> statement-breakpoint
CREATE INDEX "turn_retrievals_turn_idx" ON "turn_retrievals" USING btree ("turn_id");--> statement-breakpoint
CREATE INDEX "turn_retrievals_session_idx" ON "turn_retrievals" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_participant_code_unique" UNIQUE("participant_code");