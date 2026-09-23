CREATE TABLE "book_topic_coverage" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"covered" boolean NOT NULL,
	"matched_segments" integer NOT NULL,
	"best_distance" real,
	"pages" text NOT NULL,
	"segment_ids" text NOT NULL,
	"max_distance" real NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD COLUMN "focus_topics" text;--> statement-breakpoint
ALTER TABLE "session_turns" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "book_topic_coverage" ADD CONSTRAINT "book_topic_coverage_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_topic_coverage_book_topic_idx" ON "book_topic_coverage" USING btree ("book_id","topic_id");--> statement-breakpoint
CREATE INDEX "book_topic_coverage_book_idx" ON "book_topic_coverage" USING btree ("book_id");