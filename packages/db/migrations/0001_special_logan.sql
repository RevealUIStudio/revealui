ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_status_check" CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_type_check" CHECK (type IN ('fact', 'preference', 'decision', 'feedback', 'example', 'correction', 'skill', 'warning'));--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_status_check" CHECK (status IN ('active', 'archived', 'ended'));--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_role_check" CHECK (role IN ('user', 'assistant', 'system'));--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_device_type_check" CHECK (device_type IS NULL OR device_type IN ('desktop', 'mobile', 'tablet', 'cli'));--> statement-breakpoint
ALTER TABLE "account_entitlements" ADD CONSTRAINT "account_entitlements_metering_status_check" CHECK (metering_status IN ('active', 'paused', 'exceeded'));--> statement-breakpoint
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_role_check" CHECK (role IN ('owner', 'admin', 'member'));--> statement-breakpoint
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_status_check" CHECK (status IN ('active', 'invited', 'revoked'));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_status_check" CHECK (status IN ('active', 'suspended', 'closed'));--> statement-breakpoint
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_source_check" CHECK (source IN ('system', 'user', 'agent', 'api'));--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_status_check" CHECK (status IN ('draft', 'published', 'archived'));--> statement-breakpoint
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_provider_check" CHECK (provider IN ('ollama', 'huggingface', 'vultr', 'inference-snaps'));--> statement-breakpoint
ALTER TABLE "app_logs" ADD CONSTRAINT "app_logs_level_check" CHECK (level IN ('warn', 'error', 'fatal'));--> statement-breakpoint
ALTER TABLE "app_logs" ADD CONSTRAINT "app_logs_app_check" CHECK (app IN ('admin', 'api', 'marketing', 'mainframe'));--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_severity_check" CHECK (severity IN ('info', 'warn', 'critical'));--> statement-breakpoint
ALTER TABLE "circuit_breaker_state" ADD CONSTRAINT "circuit_breaker_state_check" CHECK (state IN ('closed', 'open', 'half-open'));--> statement-breakpoint
ALTER TABLE "code_provenance" ADD CONSTRAINT "code_provenance_author_type_check" CHECK (author_type IN ('ai_generated', 'human_written', 'ai_assisted', 'mixed'));--> statement-breakpoint
ALTER TABLE "code_provenance" ADD CONSTRAINT "code_provenance_review_status_check" CHECK (review_status IN ('unreviewed', 'reviewed', 'approved', 'rejected'));--> statement-breakpoint
ALTER TABLE "code_reviews" ADD CONSTRAINT "code_reviews_review_type_check" CHECK (review_type IN ('human_review', 'ai_review', 'human_approval', 'ai_suggestion'));--> statement-breakpoint
ALTER TABLE "code_reviews" ADD CONSTRAINT "code_reviews_status_check" CHECK (status IN ('approved', 'rejected', 'needs_changes', 'informational'));--> statement-breakpoint
ALTER TABLE "coordination_queue_items" ADD CONSTRAINT "coordination_queue_items_priority_check" CHECK (priority IN ('low', 'normal', 'high', 'urgent'));--> statement-breakpoint
ALTER TABLE "coordination_sessions" ADD CONSTRAINT "coordination_sessions_status_check" CHECK (status IN ('active', 'ended', 'crashed'));--> statement-breakpoint
ALTER TABLE "coordination_work_items" ADD CONSTRAINT "coordination_work_items_status_check" CHECK (status IN ('open', 'claimed', 'done', 'cancelled'));--> statement-breakpoint
ALTER TABLE "crdt_operations" ADD CONSTRAINT "crdt_operations_crdt_type_check" CHECK (crdt_type IN ('lww_register', 'or_set', 'pn_counter'));--> statement-breakpoint
ALTER TABLE "crdt_operations" ADD CONSTRAINT "crdt_operations_operation_type_check" CHECK (operation_type IN ('set', 'add', 'remove', 'increment', 'decrement'));--> statement-breakpoint
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_level_check" CHECK (level IN ('error', 'fatal', 'warn'));--> statement-breakpoint
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_app_check" CHECK (app IN ('admin', 'api', 'marketing'));--> statement-breakpoint
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_context_check" CHECK (context IS NULL OR context IN ('server', 'client', 'edge'));--> statement-breakpoint
ALTER TABLE "gdpr_breaches" ADD CONSTRAINT "gdpr_breaches_severity_check" CHECK (severity IN ('low', 'medium', 'high', 'critical'));--> statement-breakpoint
ALTER TABLE "gdpr_breaches" ADD CONSTRAINT "gdpr_breaches_status_check" CHECK (status IN ('detected', 'investigating', 'notified', 'resolved'));--> statement-breakpoint
ALTER TABLE "gdpr_consents" ADD CONSTRAINT "gdpr_consents_type_check" CHECK (type IN ('necessary', 'functional', 'analytics', 'marketing', 'personalization'));--> statement-breakpoint
ALTER TABLE "gdpr_deletion_requests" ADD CONSTRAINT "gdpr_deletion_requests_status_check" CHECK (status IN ('pending', 'processing', 'completed', 'failed'));--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_state_check" CHECK (state IN ('created', 'active', 'completed', 'failed', 'retry'));--> statement-breakpoint
ALTER TABLE "marketplace_servers" ADD CONSTRAINT "marketplace_servers_status_check" CHECK (status IN ('pending', 'active', 'suspended'));--> statement-breakpoint
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_status_check" CHECK (status IN ('pending', 'completed', 'failed'));--> statement-breakpoint
ALTER TABLE "node_id_mappings" ADD CONSTRAINT "node_id_mappings_entity_type_check" CHECK (entity_type IN ('session', 'user'));--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_status_check" CHECK (status IN ('draft', 'published', 'archived', 'scheduled'));--> statement-breakpoint
ALTER TABLE "revealcoin_price_snapshots" ADD CONSTRAINT "revealcoin_price_snapshots_source_check" CHECK (source IN ('jupiter', 'raydium', 'manual'));--> statement-breakpoint
ALTER TABLE "marketplace_agents" ADD CONSTRAINT "marketplace_agents_pricing_model_check" CHECK (pricing_model IN ('per-task', 'per-minute', 'flat'));--> statement-breakpoint
ALTER TABLE "marketplace_agents" ADD CONSTRAINT "marketplace_agents_status_check" CHECK (status IN ('draft', 'published', 'suspended', 'deprecated'));--> statement-breakpoint
ALTER TABLE "marketplace_agents" ADD CONSTRAINT "marketplace_agents_category_check" CHECK (category IN ('coding', 'writing', 'data', 'design', 'other'));--> statement-breakpoint
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_status_check" CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "site_collaborators" ADD CONSTRAINT "site_collaborators_role_check" CHECK (role IN ('owner', 'admin', 'editor', 'viewer'));--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_status_check" CHECK (status IN ('draft', 'published', 'archived'));--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_check" CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done', 'closed'));--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_priority_check" CHECK (priority IN ('critical', 'high', 'medium', 'low'));--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_type_check" CHECK (type IN ('bug', 'feature', 'task', 'improvement', 'epic'));--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_source_type_check" CHECK (source_type IN ('admin_collection', 'url', 'file', 'text'));--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_status_check" CHECK (status IN ('pending', 'processing', 'indexed', 'failed'));