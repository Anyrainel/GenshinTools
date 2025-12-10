import React from "react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      {/* Header is now managed by individual pages using ToolHeader */}
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
};

export { Layout };
