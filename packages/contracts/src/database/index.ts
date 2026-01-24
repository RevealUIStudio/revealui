/**
 * @revealui/contracts/database
 *
 * Database contract bridges - type-safe conversion between database types and contracts
 */

// Re-export contractToDbInsert for convenience
export {
	contractToDbInsert,
	DatabaseContractRegistry,
	databaseContractRegistry,
	dbRowToContract,
	isDbRowMatchingContract,
	safeDbRowToContract,
	type TableInsertType,
	type TableName,
	type TableRowType,
	type TableUpdateType,
} from "./bridge.js";
export {
	batchContractToDbInsert,
	batchDbRowsToContract,
	type ContractToDrizzleInsert,
	createContractToDbMapper,
	createDbRowMapper,
	createTableContractRegistry,
	type DrizzleToContract,
	isDbRowAndContract,
	type TableContractMap,
} from "./type-bridge.js";
