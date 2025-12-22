/**
 * PluginSlot Component
 *
 * A React component that renders plugin-injected components at designated slots.
 * It fetches registered components from the plugin registry and renders them
 * with the appropriate props.
 *
 * @example
 * // In NoteCard.tsx
 * <PluginSlot
 *   slot="note:footer"
 *   props={{ noteId: note.id, userId: note.userId }}
 * />
 */

import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
  Suspense,
  useMemo,
} from "react";
import type { PluginSlotName, SlotProps } from "./types.js";
import { usePluginSlotComponents } from "./registry.js";

/**
 * Props for the PluginSlot component
 */
interface PluginSlotProps<T extends PluginSlotName> {
  /** The slot name to render */
  slot: T;
  /** Props to pass to slot components (excluding pluginId) */
  props: Omit<SlotProps[T], "pluginId">;
  /** Optional wrapper className */
  className?: string;
  /** Fallback component while loading */
  fallback?: React.ReactNode;
}

/**
 * Error fallback UI for plugin components
 */
function PluginErrorFallback({ pluginId }: { pluginId: string }) {
  return (
    <div className="text-xs text-red-500 p-1">
      Plugin error: {pluginId}
    </div>
  );
}

/**
 * Error boundary props
 */
interface PluginErrorBoundaryProps {
  pluginId: string;
  children: ReactNode;
}

/**
 * Error boundary state
 */
interface PluginErrorBoundaryState {
  hasError: boolean;
}

/**
 * Error boundary for plugin components
 *
 * This class component catches React rendering errors that cannot be caught
 * by try/catch in function components. It provides a fallback UI when a
 * plugin component fails to render.
 */
class PluginErrorBoundary extends Component<
  PluginErrorBoundaryProps,
  PluginErrorBoundaryState
> {
  constructor(props: PluginErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): PluginErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`Plugin ${this.props.pluginId} error:`, error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <PluginErrorFallback pluginId={this.props.pluginId} />;
    }
    return this.props.children;
  }
}

/**
 * Wrapper that renders plugin components with error boundary protection
 */
function PluginComponentWrapper<T extends PluginSlotName>({
  Component: PluginComponent,
  pluginId,
  props,
}: {
  Component: ComponentType<SlotProps[T]>;
  pluginId: string;
  props: Omit<SlotProps[T], "pluginId">;
}) {
  const fullProps = { ...props, pluginId } as SlotProps[T];
  return (
    <PluginErrorBoundary pluginId={pluginId}>
      <PluginComponent {...fullProps} />
    </PluginErrorBoundary>
  );
}

/**
 * PluginSlot renders all plugin components registered for a specific slot.
 *
 * This component:
 * 1. Fetches all registered components for the given slot
 * 2. Renders each component with the provided props
 * 3. Handles errors gracefully without breaking the host component
 * 4. Supports Suspense for async component loading
 */
export function PluginSlot<T extends PluginSlotName>({
  slot,
  props,
  className,
  fallback = null,
}: PluginSlotProps<T>) {
  const components = usePluginSlotComponents(slot);

  const renderedComponents = useMemo(() => {
    if (components.length === 0) {
      return null;
    }

    return components.map(({ pluginId, component }) => (
      <Suspense key={pluginId} fallback={fallback}>
        <PluginComponentWrapper<T>
          Component={component as ComponentType<SlotProps[T]>}
          pluginId={pluginId}
          props={props}
        />
      </Suspense>
    ));
  }, [components, props, fallback]);

  if (!renderedComponents) {
    return null;
  }

  if (className) {
    return <div className={className}>{renderedComponents}</div>;
  }

  return <>{renderedComponents}</>;
}
