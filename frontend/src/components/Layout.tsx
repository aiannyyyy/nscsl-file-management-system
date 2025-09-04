import { ReactNode } from "react";
import { Link } from "react-router-dom";

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-700 text-white flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-blue-600">
          📂 File Manager
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/" className="block px-3 py-2 rounded hover:bg-blue-600">
            Dashboard
          </Link>
          <Link to="/files" className="block px-3 py-2 rounded hover:bg-blue-600">
            Files
          </Link>
          <Link to="/settings" className="block px-3 py-2 rounded hover:bg-blue-600">
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-14 bg-white shadow flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold">
            Intranet File Management System
          </h1>
          <div className="text-gray-600">👤 User</div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
