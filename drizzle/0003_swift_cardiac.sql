ALTER TABLE "voice_sessions" ADD COLUMN "vapi_call_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "voice_sessions_vapi_call_idx" ON "voice_sessions" USING btree ("vapi_call_id");