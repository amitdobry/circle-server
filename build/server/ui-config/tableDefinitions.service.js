"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllTableDefinitions = getAllTableDefinitions;
const tableDefinitions_1 = require("./tableDefinitions");
/**
 * Service function to get all table definitions
 * Used by socket handler to serve tables to frontend
 */
function getAllTableDefinitions() {
    return tableDefinitions_1.TABLE_DEFINITIONS;
}
