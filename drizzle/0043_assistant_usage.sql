CREATE TABLE IF NOT EXISTS "console_assistant_usage" (
	"kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"day" date NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_assistant_usage_kind_subject_id_day_pk" PRIMARY KEY("kind","subject_id","day")
);
