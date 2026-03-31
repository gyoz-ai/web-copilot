export interface TaskMemory {
  goal: string | null;
  pagesVisited: Array<{ url: string; title: string; summary: string }>;
  factsFound: Array<{ key: string; value: string; source: string }>;
  formsTouched: Array<{ selector: string; field: string; value: string }>;
  pendingClarification: string | null;
  previousFailures: Array<{
    action: string;
    error: string;
    strategy: string;
  }>;
  navigationChain: string[];
}

export function createEmptyTaskMemory(): TaskMemory {
  return {
    goal: null,
    pagesVisited: [],
    factsFound: [],
    formsTouched: [],
    pendingClarification: null,
    previousFailures: [],
    navigationChain: [],
  };
}

/** Format task memory as context string for injection into prompt */
export function formatTaskMemory(memory: TaskMemory): string | null {
  const parts: string[] = [];
  if (memory.goal) parts.push(`Goal: ${memory.goal}`);
  if (memory.pagesVisited.length > 0) {
    parts.push(
      `Pages visited: ${memory.pagesVisited.map((p) => `${p.title} (${p.url})`).join(", ")}`,
    );
  }
  if (memory.factsFound.length > 0) {
    parts.push(
      `Known facts:\n${memory.factsFound.map((f) => `- ${f.key}: ${f.value}`).join("\n")}`,
    );
  }
  if (memory.previousFailures.length > 0) {
    parts.push(
      `Previous failures:\n${memory.previousFailures.map((f) => `- ${f.action}: ${f.error}`).join("\n")}`,
    );
  }
  return parts.length > 0 ? parts.join("\n\n") : null;
}
