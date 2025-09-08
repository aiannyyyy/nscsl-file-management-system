import { useState, useEffect } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import Files from "./components/Files";
import Categories from "./components/Categories";
import CategoryFiles from "./components/CategoryFiles";
import Login from "./components/Login";

interface User {
  name: string;
  user_name: string;
  department?: string;
  role: string;
}

interface UserData {
  token: string;
  user: User;
}

// Temporary Settings Page
function Settings() {
  return <h2 className="text-2xl font-bold">⚙️ Settings Page</h2>;
}

// Error Page
function ErrorPage() {
  return (
    <div className="h-screen flex flex-col items-center justify-center text-red-600">
      <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
      <p className="mt-2">The page you're looking for doesn't exist.</p>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('userData');
    
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUserData({ token, user: parsedUser });
        setIsAuthenticated(true);
      } catch (error) {
        // Clear invalid stored data
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
      }
    }
    setIsLoading(false);
  }, []);

  const handleLoginSuccess = (userData: UserData) => {
    setUserData(userData);
    setIsAuthenticated(true);
    
    // Store in localStorage for persistence
    localStorage.setItem('authToken', userData.token);
    localStorage.setItem('userData', JSON.stringify(userData.user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserData(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
  };

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // If not authenticated, show login
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Define authenticated routes
  const router = createBrowserRouter([
    {
      path: "/",
      element: <Navigate to="/dashboard" replace />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/dashboard",
      element: (
        <Layout userData={userData} onLogout={handleLogout}>
          <Dashboard />
        </Layout>
      ),
      errorElement: <ErrorPage />,
    },
    {
      path: "/files",
      element: (
        <Layout userData={userData} onLogout={handleLogout}>
          <Files />
        </Layout>
      ),
      errorElement: <ErrorPage />,
    },
    {
      path: "/categories",
      element: (
        <Layout userData={userData} onLogout={handleLogout}>
          <Categories />
        </Layout>
      ),
      errorElement: <ErrorPage />,
    },
    {
      path: "/categoriesFiles",
      element: (
        <Layout userData={userData} onLogout={handleLogout}>
          <CategoryFiles />
        </Layout>
      ),
      errorElement: <ErrorPage />,
    },
    {
      path: "/settings",
      element: (
        <Layout userData={userData} onLogout={handleLogout}>
          <Settings />
        </Layout>
      ),
      errorElement: <ErrorPage />,
    },
  ]);

  return <RouterProvider router={router} />;
}