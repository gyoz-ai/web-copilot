import { storageGet } from "../../lib/storage";

export function handleSaveExpression(
  message: { expression: string },
  sendResponse: (result: unknown) => void,
): void {
  browser.storage.local
    .set({ gyozai_expression: message.expression })
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
}

export function handleLoadExpression(
  sendResponse: (result: unknown) => void,
): void {
  storageGet("gyozai_expression")
    .then((r) => sendResponse(r.gyozai_expression ?? null))
    .catch(() => sendResponse(null));
}
