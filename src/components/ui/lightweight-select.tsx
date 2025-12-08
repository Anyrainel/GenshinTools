import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

interface LightweightSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  autoOpen?: boolean; // Auto-open on mount
}

interface LightweightSelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  shortLabel?: string; // Optional short label for trigger display
}

export function LightweightSelect({
  value,
  onValueChange,
  children,
  className,
  autoOpen = false,
}: LightweightSelectProps) {
  const [isOpen, setIsOpen] = React.useState(autoOpen);
  const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Get options from children
  const options = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<LightweightSelectItemProps> =>
      React.isValidElement(child)
  );

  // Find selected option
  const selectedOption = options.find(opt => opt.props.value === value);
  // Use shortLabel if provided, otherwise use children
  const displayText = selectedOption?.props.shortLabel || selectedOption?.props.children || '';

  // Calculate dropdown position based on viewport and trigger position
  const updateDropdownPosition = React.useCallback(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Estimate dropdown height (max 320px = max-h-80)
      const estimatedDropdownHeight = Math.min(options.length * 36, 320);

      // If not enough space below and more space above, show on top
      const shouldShowOnTop = spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow;

      // Set absolute position relative to viewport
      setDropdownStyle({
        position: 'fixed',
        left: `${rect.left}px`,
        minWidth: `${rect.width}px`,  // At least as wide as trigger
        top: shouldShowOnTop ? 'auto' : `${rect.bottom + 4}px`,
        bottom: shouldShowOnTop ? `${viewportHeight - rect.top + 4}px` : 'auto',
      });
    }
  }, [isOpen, options.length]);

  React.useEffect(() => {
    updateDropdownPosition();
  }, [updateDropdownPosition]);

  // Re-position on scroll
  React.useEffect(() => {
    if (isOpen) {
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside both the trigger container and the dropdown portal
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        // Also check if the click is not on the dropdown (which is in a portal)
        !(target as Element).closest('[data-dropdown-portal]')
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Use a slight delay to avoid closing immediately after opening
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleSelect = React.useCallback((newValue: string) => {
    onValueChange(newValue);
    setIsOpen(false);
  }, [onValueChange]);

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-gradient-mystical-reverse px-3 py-2 text-sm select-none ring-offset-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer text-left ${className || ''}`}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
        </button>
      </div>

      {/* Render dropdown in portal to escape parent overflow constraints */}
      {isOpen && createPortal(
        <div
          data-dropdown-portal="true"
          style={dropdownStyle}
          className="overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 max-h-80 w-max z-[9999]"
        >
          <div className="p-1">
            {options.map((option) => (
              <div
                key={option.props.value}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent focus loss
                  handleSelect(option.props.value);
                }}
                className={`relative flex w-full select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors ${option.props.value === value ? 'bg-accent/50' : ''} ${option.props.className || ''}`}
              >
                {option.props.children}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function LightweightSelectItem(_props: LightweightSelectItemProps) {
  // This is just a container component for options
  // The actual rendering is done by LightweightSelect
  // Props (value, children, className) are extracted in parent component
  return null;
}
