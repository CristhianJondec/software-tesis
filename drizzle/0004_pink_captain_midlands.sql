CREATE TABLE "survey_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"survey_type" text NOT NULL,
	"phase" text NOT NULL,
	"answers" jsonb NOT NULL,
	"computed_score" real NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "survey_responses_user_instrument_phase_idx" ON "survey_responses" USING btree ("user_id","survey_type","phase");--> statement-breakpoint
CREATE INDEX "survey_responses_user_idx" ON "survey_responses" USING btree ("user_id");