CREATE TABLE "nudge_dismissals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"nudge_id" text NOT NULL,
	"dismiss_count" integer DEFAULT 1 NOT NULL,
	"last_dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nudge_dismissals_dismiss_count_check" CHECK (dismiss_count BETWEEN 1 AND 2)
);
--> statement-breakpoint
ALTER TABLE "nudge_dismissals" ADD CONSTRAINT "nudge_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "nudge_dismissals_user_nudge_idx" ON "nudge_dismissals" USING btree ("user_id","nudge_id");--> statement-breakpoint
CREATE INDEX "nudge_dismissals_user_id_idx" ON "nudge_dismissals" USING btree ("user_id");
