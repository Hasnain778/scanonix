type Listener = () => void;

let openMenuId: string | null = null;
const listeners = new Set<Listener>();

export function getOpenActionsMenuId(): string | null {
  return openMenuId;
}

export function setOpenActionsMenuId(id: string | null): void {
  if (openMenuId === id) return;
  openMenuId = id;
  listeners.forEach((listener) => listener());
}

export function subscribeOpenActionsMenu(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function closeActionsMenu(): void {
  setOpenActionsMenuId(null);
}
