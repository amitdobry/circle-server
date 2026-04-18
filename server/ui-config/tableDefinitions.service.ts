import { TABLE_DEFINITIONS, TableDefinition } from "./tableDefinitions";

/**
 * Service function to get all table definitions
 * Used by socket handler to serve tables to frontend
 */
export function getAllTableDefinitions(): TableDefinition[] {
  return TABLE_DEFINITIONS;
}
