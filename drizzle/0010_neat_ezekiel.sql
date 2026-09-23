CREATE TABLE "study_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"file_name" text NOT NULL,
	"file_blob_key" text NOT NULL,
	"file_size" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_materials_sort_idx" ON "study_materials" USING btree ("sort_order","created_at");