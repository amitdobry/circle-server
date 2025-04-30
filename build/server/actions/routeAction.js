"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeAction = routeAction;
const actionConfig_1 = require("./actionConfig");
const handlersMap_1 = require("./handlersMap"); // we'll set this up
function routeAction(payload, context) {
    const { actionType, type } = payload;
    const match = actionConfig_1.config.find((entry) => entry.actionType === actionType && (!entry.type || entry.type === type));
    if (!match) {
        console.warn("[Router] ❌ No matching handler found for:", payload);
        return;
    }
    const handler = handlersMap_1.handlersMap[match.handler];
    if (!handler) {
        console.warn(`[Router] ❌ Handler not implemented: ${match.handler}`);
        return;
    }
    handler(payload, context);
}
