import { useSyncExternalStore } from "react";

type Listener = () => void;

export function createStore<T>(
  initialState: T,
  onChange?: (prev: T, next: T) => void,
) {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState: (updater: (prev: T) => T) => {
      const prev = state;
      state = updater(prev);
      if (state !== prev) {
        onChange?.(prev, state);
        listeners.forEach((l) => l());
      }
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T, S>(
  store: ReturnType<typeof createStore<T>>,
  selector: (state: T) => S,
): S {
  return useSyncExternalStore(store.subscribe, () =>
    selector(store.getState()),
  );
}
