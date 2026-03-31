CREATE INDEX "agent_actions_conversation_id_idx" ON "agent_actions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "agent_actions_agent_id_idx" ON "agent_actions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_actions_status_idx" ON "agent_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crdt_operations_crdt_id_idx" ON "crdt_operations" USING btree ("crdt_id");--> statement-breakpoint
CREATE INDEX "crdt_operations_node_id_idx" ON "crdt_operations" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "boards_tenant_id_idx" ON "boards" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "boards_owner_id_idx" ON "boards" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "ticket_labels_tenant_id_idx" ON "ticket_labels" USING btree ("tenant_id");