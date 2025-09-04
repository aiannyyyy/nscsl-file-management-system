import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import "./index.css";

function Files() {
  return <h2 className="text-2xl font-bold">📂 Files Page</h2>;
}

function Settings() {
  return <h2 className="text-2xl font-bold">⚙️ Settings Page</h2>;
}

function ErrorPage() {
  return (
    <div className="h-screen flex flex-col items-center justify-center text-red-600">
      <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
      <p className="mt-2">The page you’re looking for doesn’t exist.</p>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Layout>
        <Dashboard />
      </Layout>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/files",
    element: (
      <Layout>
        <Files />
      </Layout>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: "/settings",
    element: (
      <Layout>
        <Settings />
      </Layout>
    ),
    errorElement: <ErrorPage />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
