CREATE TABLE "ragas_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"turn_id" text NOT NULL,
	"prompt_version" text NOT NULL,
	"faithfulness" real,
	"answer_relevancy" real,
	"context_precision" real,
	"context_recall" real,
	"detail" text,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turn_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"turn_id" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"notes" text,
	"evaluated_by" text,
	"evaluated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ragas_evaluations" ADD CONSTRAINT "ragas_evaluations_turn_id_session_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."session_turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_evaluations" ADD CONSTRAINT "turn_evaluations_turn_id_session_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."session_turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_evaluations" ADD CONSTRAINT "turn_evaluations_evaluated_by_users_id_fk" FOREIGN KEY ("evaluated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ragas_evaluations_turn_version_idx" ON "ragas_evaluations" USING btree ("turn_id","prompt_version");--> statement-breakpoint
CREATE INDEX "ragas_evaluations_version_idx" ON "ragas_evaluations" USING btree ("prompt_version");--> statement-breakpoint
CREATE UNIQUE INDEX "turn_evaluations_turn_idx" ON "turn_evaluations" USING btree ("turn_id");