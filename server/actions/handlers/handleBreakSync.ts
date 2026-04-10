import { ActionPayload, ActionContext } from "../routeAction";
import { setPointer } from "../../socketHandler";

export function handleBreakSync(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name } = payload;
  const { pointerMap, io, logAction, logSystem, evaluateSync } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  setPointer("default-room", name, name);
  io.emit("update-pointing", { from: name, to: name });
  logAction(`👄 ${name} requests the mic (breakSync)`);

  evaluateSync();
}
