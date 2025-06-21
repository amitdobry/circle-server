import { ActionPayload, ActionContext } from "../routeAction";

export function handleBreakSync(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { pointerMap, io, logAction, logSystem, evaluateSync } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  pointerMap.set(name, name);
  io.emit("update-pointing", { from: name, to: name });
  logAction(`👄 ${name} requests the mic (breakSync)`);

  evaluateSync();
}
