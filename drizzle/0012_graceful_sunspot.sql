CREATE TABLE "system_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"user_id" text,
	"level" text NOT NULL,
	"source" text NOT NULL,
	"event" text NOT NULL,
	"message" text NOT NULL,
	"duration_ms" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_session_id_voice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "system_logs_created_idx" ON "system_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "system_logs_session_created_idx" ON "system_logs" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "system_logs_user_created_idx" ON "system_logs" USING btree ("user_id","created_at");