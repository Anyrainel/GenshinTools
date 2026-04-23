/**
 * Handle interface for control components that can be opened programmatically.
 * Controls expose `.open()` via ref using forwardRef + useImperativeHandle.
 */
export interface ControlHandle {
  open: (options?: unknown) => void;
}
