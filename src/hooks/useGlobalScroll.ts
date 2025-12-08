import { useEffect, RefObject } from 'react';

/**
 * Custom hook to handle global scroll behavior for views with sidebars.
 *
 * When scrolling:
 * - Over the sidebar: sidebar scrolls (native behavior)
 * - Over main content: main content scrolls (native behavior)
 * - Over margin/padding areas: main content scrolls (custom behavior)
 *
 * @param containerRef - Reference to the container element
 * @param mainScrollRef - Reference to the main scrollable content element
 * @param sidebarSelector - CSS selector for the sidebar element (default: 'aside')
 */
export function useGlobalScroll(
  containerRef: RefObject<HTMLElement>,
  mainScrollRef: RefObject<HTMLElement>,
  sidebarSelector: string = 'aside'
) {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!containerRef.current || !mainScrollRef.current) return;

      const target = e.target as HTMLElement;

      // Check if we're scrolling over the sidebar (it has its own scroll)
      const sidebar = containerRef.current.querySelector(sidebarSelector);
      if (sidebar && sidebar.contains(target)) {
        // Let sidebar handle its own scrolling
        return;
      }

      // Check if we're scrolling over the main content itself
      const mainContent = mainScrollRef.current;
      if (mainContent && mainContent.contains(target)) {
        // Let main content handle its own native scrolling (smooth!)
        return;
      }

      // We're in margin/padding areas - manually scroll main content
      if (mainScrollRef.current.scrollHeight > mainScrollRef.current.clientHeight) {
        e.preventDefault();
        mainScrollRef.current.scrollBy({
          top: e.deltaY,
          behavior: 'auto' // Use 'auto' for instant response, 'smooth' feels too laggy
        });
      }
    };

    // Attach to the window to capture all wheel events
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [containerRef, mainScrollRef, sidebarSelector]);
}
