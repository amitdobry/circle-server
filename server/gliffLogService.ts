// server/gliffLogService.ts
import { Server } from "socket.io";

export type MessageType = "gesture" | "action" | "textInput" | "context";

export type GliffMessage = {
  userName: string;
  message: {
    messageType: MessageType;
    content: string;
    timestamp: number;
    emoji?: string;
  };
};

// Phase E: Room-scoped gliff memory
const gliffMemoryByRoom = new Map<string, GliffMessage[]>();
const MAX_MEMORY_SIZE = 20;

/**
 * Get or create gliff memory for a specific room
 */
function getGliffMemory(roomId: string): GliffMessage[] {
  if (!gliffMemoryByRoom.has(roomId)) {
    gliffMemoryByRoom.set(roomId, []);
  }
  return gliffMemoryByRoom.get(roomId)!;
}

export function createGliffLog(
  entry: GliffMessage,
  io: Server,
  roomId: string = "default-room",
) {
  const gliffMemory = getGliffMemory(roomId);
  const enriched: GliffMessage = {
    ...entry,
    message: {
      ...entry.message,
      timestamp: Date.now(),
    },
  };

  const isText = enriched.message.messageType === "textInput";

  if (isText) {
    const last = gliffMemory[gliffMemory.length - 1];

    const canMerge =
      last &&
      last.userName === enriched.userName &&
      last.message.messageType === "textInput";

    const char = enriched.message.content;

    if (canMerge) {
      if (char === "__BACKSPACE__") {
        last.message.content = last.message.content.slice(0, -1);
      } else {
        last.message.content += char.slice(-1);
      }
      last.message.timestamp = enriched.message.timestamp;
    } else {
      if (char !== "__BACKSPACE__") {
        enriched.message.content = char.slice(-1);
        gliffMemory.push(enriched);
      }
    }
  } else {
    // Flush on gesture/action/context/etc
    gliffMemory.push(enriched);
  }

  // Trim memory
  while (gliffMemory.length > MAX_MEMORY_SIZE) {
    gliffMemory.shift();
  }

  console.log(
    `🧾 [Room ${roomId}] gliffMemory snapshot:\n` +
      JSON.stringify(gliffMemory, null, 2),
  );

  // Phase E: Room-scoped broadcast
  io.to(roomId).emit("gliffLog:update", gliffMemory);
  return enriched;
}

// Function to clear the gliff log (e.g., when session ends)
export function clearGliffLog(io: Server, roomId: string = "default-room") {
  console.log(`🧹 [Room ${roomId}] Clearing gliff log - session ended`);
  const gliffMemory = getGliffMemory(roomId);
  gliffMemory.length = 0; // Clear the array
  io.to(roomId).emit("gliffLog:update", gliffMemory); // Notify room clients
}
