CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"source" text,
	"referrer" text,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
