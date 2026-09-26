-- Spec 02 slices 1–2: scoped budget policies, ledgers, incidents, and the
-- single-statement apply function. Jobs gain a terminal `cancelled` state
-- so a later hard-stop slice can retire queued agent.dispatch work.
--
-- budget_apply_spend is one statement from the driver. Inside it, the
-- advisory lock is taken first and the read/write runs as the next command
-- in that same transaction, so the snapshot is taken after the lock. A
-- single CTE cannot do that under READ COMMITTED: its snapshot is fixed at
-- statement start, before the lock wait, and a second write of the same
-- ledger row in one statement is not supported. Neon HTTP has no
-- multi-statement transaction, so the function is the atomic boundary.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DO $$ ADD CONSTRAINT,
-- DROP CONSTRAINT IF EXISTS, CREATE OR REPLACE FUNCTION.

CREATE TABLE IF NOT EXISTS "budget_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"metric" text NOT NULL,
	"window_kind" text NOT NULL,
	"limit_amount" bigint NOT NULL,
	"warn_percent" integer,
	"hard_stop" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_policies_scope_type_check" CHECK (scope_type IN ('account', 'agent', 'goal')),
	CONSTRAINT "budget_policies_metric_check" CHECK (metric IN ('cost_micros', 'governed_actions', 'tasks')),
	CONSTRAINT "budget_policies_window_check" CHECK (window_kind IN ('calendar_month_utc', 'calendar_day_utc', 'lifetime')),
	CONSTRAINT "budget_policies_warn_check" CHECK (warn_percent IS NULL OR (warn_percent > 0 AND warn_percent < 100)),
	CONSTRAINT "budget_policies_limit_check" CHECK (limit_amount >= 0)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "budget_ledgers" (
	"policy_id" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"spent" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_ledgers_pkey" PRIMARY KEY ("policy_id", "window_start"),
	CONSTRAINT "budget_ledgers_spent_check" CHECK (spent >= 0)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "budget_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"threshold_type" text NOT NULL,
	"amount_limit" bigint NOT NULL,
	"amount_observed" bigint NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by_user_id" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "budget_incidents_scope_type_check" CHECK (scope_type IN ('account', 'agent', 'goal')),
	CONSTRAINT "budget_incidents_threshold_check" CHECK (threshold_type IN ('warn', 'hard_stop')),
	CONSTRAINT "budget_incidents_status_check" CHECK (status IN ('open', 'resolved')),
	CONSTRAINT "budget_incidents_resolution_check" CHECK (resolution IS NULL OR resolution IN ('limit_raised', 'policy_deactivated', 'override', 'window_rolled'))
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "budget_policies_scope_metric_window_uq" ON "budget_policies" USING btree ("account_id", "scope_type", "scope_id", "metric", "window_kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_policies_account_active_idx" ON "budget_policies" USING btree ("account_id", "is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "budget_incidents_policy_window_threshold_uq" ON "budget_incidents" USING btree ("policy_id", "window_start", "threshold_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_incidents_scope_open_idx" ON "budget_incidents" USING btree ("account_id", "scope_type", "scope_id", "status");--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "budget_policies" ADD CONSTRAINT "budget_policies_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "budget_ledgers" ADD CONSTRAINT "budget_ledgers_policy_id_budget_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."budget_policies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "budget_incidents" ADD CONSTRAINT "budget_incidents_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "budget_incidents" ADD CONSTRAINT "budget_incidents_policy_id_budget_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."budget_policies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_state_check";--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "jobs" ADD CONSTRAINT "jobs_state_check" CHECK (state IN ('created', 'active', 'completed', 'failed', 'retry', 'cancelled'));
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION budget_apply_spend(
	p_account_id text,
	p_metric text,
	p_units bigint,
	p_at timestamptz,
	p_scopes jsonb,
	p_kind text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $budget_apply$
DECLARE
	v_result jsonb;
BEGIN
	IF p_kind <> 'reserve' AND p_kind <> 'record' THEN
		RAISE EXCEPTION 'budget_apply_spend: invalid kind';
	END IF;
	IF p_metric <> 'cost_micros' AND p_metric <> 'governed_actions' AND p_metric <> 'tasks' THEN
		RAISE EXCEPTION 'budget_apply_spend: invalid metric';
	END IF;
	IF p_units < 0 THEN
		RAISE EXCEPTION 'budget_apply_spend: negative units';
	END IF;
	IF p_scopes IS NULL THEN
		p_scopes := '[]'::jsonb;
	END IF;

	PERFORM pg_advisory_xact_lock(hashtextextended('budget:' || p_account_id, 0));

	WITH matched AS (
		SELECT
			p.id AS policy_id,
			p.scope_type,
			p.scope_id,
			p.limit_amount,
			p.hard_stop,
			p.warn_percent,
			CASE p.window_kind
				WHEN 'calendar_month_utc' THEN (date_trunc('month', p_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
				WHEN 'calendar_day_utc' THEN (date_trunc('day', p_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
				ELSE TIMESTAMPTZ '1970-01-01 00:00:00+00'
			END AS window_start
		FROM budget_policies p
		JOIN (
			SELECT DISTINCT s.scope_type, s.scope_id
			FROM jsonb_to_recordset(p_scopes) AS s(scope_type text, scope_id text)
		) s
			ON s.scope_type = p.scope_type
		 AND s.scope_id = p.scope_id
		WHERE p.account_id = p_account_id
			AND p.metric = p_metric
			AND p.is_active = true
	),
	current AS (
		SELECT
			m.policy_id,
			m.scope_type,
			m.scope_id,
			m.limit_amount,
			m.hard_stop,
			m.warn_percent,
			m.window_start,
			COALESCE(l.spent, 0) AS spent,
			EXISTS (
				SELECT 1
				FROM budget_incidents i
				WHERE i.policy_id = m.policy_id
					AND i.window_start = m.window_start
					AND i.threshold_type = 'hard_stop'
					AND i.status = 'open'
			) AS paused
		FROM matched m
		LEFT JOIN budget_ledgers l
			ON l.policy_id = m.policy_id
		 AND l.window_start = m.window_start
	),
	gate AS (
		SELECT CASE
			WHEN p_kind = 'record' THEN true
			WHEN NOT EXISTS (SELECT 1 FROM current) THEN true
			ELSE (
				SELECT bool_and(
					NOT c.paused
					AND (NOT c.hard_stop OR c.spent + p_units <= c.limit_amount)
				)
				FROM current c
			)
		END AS ok
	),
	applied AS (
		INSERT INTO budget_ledgers (policy_id, window_start, spent)
		SELECT c.policy_id, c.window_start, p_units
		FROM current c
		WHERE (SELECT g.ok FROM gate g)
		ON CONFLICT (policy_id, window_start) DO UPDATE
			SET spent = budget_ledgers.spent + EXCLUDED.spent,
				updated_at = now()
		RETURNING policy_id, window_start, spent
	),
	hard_opened AS (
		INSERT INTO budget_incidents (
			id, account_id, policy_id, scope_type, scope_id, window_start,
			threshold_type, amount_limit, amount_observed, status
		)
		SELECT
			gen_random_uuid()::text,
			p_account_id,
			c.policy_id,
			c.scope_type,
			c.scope_id,
			c.window_start,
			'hard_stop',
			c.limit_amount,
			CASE WHEN p_kind = 'record' THEN c.spent + p_units ELSE c.spent END,
			'open'
		FROM current c
		WHERE c.hard_stop
			AND (
				(
					p_kind = 'reserve'
					AND NOT (SELECT g.ok FROM gate g)
					AND NOT c.paused
					AND c.spent + p_units > c.limit_amount
				)
				OR (
					p_kind = 'record'
					AND c.spent <= c.limit_amount
					AND c.spent + p_units > c.limit_amount
				)
			)
		ON CONFLICT (policy_id, window_start, threshold_type) DO UPDATE
			SET status = 'open',
				amount_limit = EXCLUDED.amount_limit,
				amount_observed = EXCLUDED.amount_observed,
				resolution = NULL,
				resolved_by_user_id = NULL,
				resolved_at = NULL,
				opened_at = now()
			WHERE budget_incidents.status = 'resolved'
		RETURNING id, policy_id, scope_type, scope_id, window_start, threshold_type, amount_limit, amount_observed
	),
	warn_opened AS (
		INSERT INTO budget_incidents (
			id, account_id, policy_id, scope_type, scope_id, window_start,
			threshold_type, amount_limit, amount_observed, status
		)
		SELECT
			gen_random_uuid()::text,
			p_account_id,
			c.policy_id,
			c.scope_type,
			c.scope_id,
			c.window_start,
			'warn',
			c.limit_amount,
			c.spent + p_units,
			'open'
		FROM current c
		WHERE (SELECT g.ok FROM gate g)
			AND c.warn_percent IS NOT NULL
			AND c.spent < ((c.limit_amount * c.warn_percent) / 100)
			AND c.spent + p_units >= ((c.limit_amount * c.warn_percent) / 100)
		ON CONFLICT (policy_id, window_start, threshold_type) DO NOTHING
		RETURNING id, policy_id, scope_type, scope_id, window_start, threshold_type, amount_limit, amount_observed
	)
	SELECT jsonb_build_object(
		'allowed', (SELECT g.ok FROM gate g),
		'policyCount', (SELECT count(*) FROM matched),
		'applied', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'policyId', a.policy_id,
				'scopeType', c.scope_type,
				'scopeId', c.scope_id,
				'windowStart', a.window_start,
				'spent', a.spent
			) ORDER BY a.policy_id)
			FROM applied a
			JOIN current c ON c.policy_id = a.policy_id
		), '[]'::jsonb),
		'opened', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'id', o.id,
				'policyId', o.policy_id,
				'scopeType', o.scope_type,
				'scopeId', o.scope_id,
				'windowStart', o.window_start,
				'thresholdType', o.threshold_type,
				'amountLimit', o.amount_limit,
				'amountObserved', o.amount_observed
			) ORDER BY o.policy_id, o.threshold_type)
			FROM (
				SELECT * FROM hard_opened
				UNION ALL
				SELECT * FROM warn_opened
			) o
		), '[]'::jsonb),
		'pauses', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'id', i.id,
				'policyId', c.policy_id,
				'scopeType', c.scope_type,
				'scopeId', c.scope_id,
				'windowStart', c.window_start,
				'thresholdType', 'hard_stop',
				'amountLimit', i.amount_limit,
				'amountObserved', i.amount_observed
			) ORDER BY c.policy_id)
			FROM current c
			JOIN budget_incidents i
				ON i.policy_id = c.policy_id
			 AND i.window_start = c.window_start
			 AND i.threshold_type = 'hard_stop'
			 AND i.status = 'open'
		), '[]'::jsonb)
	)
	INTO v_result;

	RETURN v_result;
END;
$budget_apply$;
