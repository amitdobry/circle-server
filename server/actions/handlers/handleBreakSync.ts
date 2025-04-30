import { ActionPayload, ActionContext } from "../routeAction";

export function handleBreakSync(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { pointerMap, io, log, evaluateSync } = context;

  if (!name) {
    log("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  pointerMap.set(name, name);
  io.emit("update-pointing", { from: name, to: name });
  log(`👄 ${name} requests the mic (breakSync)`);

  evaluateSync();
}
