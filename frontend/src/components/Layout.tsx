import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Home,
  FileText,
  Settings,
  Search,
  User,
  FolderOpen,
  ChevronDown,
  Building2,
  LogOut,
  Folder,
  ChevronRight,
  Loader2,
  XCircle
} from "lucide-react";
import axios from "axios";

interface User {
  id?: string | number;
  name: string;
  user_name: string;
  department?: string;
  role: string;
  email?: string;
}

interface UserData {
  token: string;
  user: User;
}

type LayoutProps = {
  children: React.ReactNode;
  userData: UserData;
  onLogout: () => void;
};

interface SearchFile {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  folder_id: number | null;
  folder_name: string | null;
  created_at: string;
  created_by_name: string;
}

interface SearchFolder {
  id: number;
  name: string;
  parent_id: number | null;
  parent_folder_name: string | null;
  created_at: string;
  created_by_name: string;
}

interface CategoryFile {
  id: number;
  name: string;
  original_name: string;
  file_type: string;
  file_size: number;
  category_id: number;
  folder_id: number | null;
  category_name: string;
  folder_name: string | null;
  created_at: string;
  created_by_name: string;
}

interface CategoryFolder {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  parent_folder_id: number | null;
  created_by_name: string;
}

interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  created_by_name: string;
}

interface SearchResults {
  files: SearchFile[];
  folders: SearchFolder[];
  categoryFiles: CategoryFile[];
  categoryFolders: CategoryFolder[];
  categories: Category[];
  totalResults: number;
}

export default function Layout({ children, userData, onLogout }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>({
    files: [],
    folders: [],
    categoryFiles: [],
    categoryFolders: [],
    categories: [],
    totalResults: 0
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleLogout = () => {
    setUserDropdownOpen(false);
    onLogout();
  };

  const isActive = (path: string) => {
    if (!mounted) return false;
    return location.pathname === path;
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownOpen) {
        setUserDropdownOpen(false);
      }
      if (searchOpen && searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userDropdownOpen, searchOpen]);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults({ 
        files: [], 
        folders: [], 
        categoryFiles: [], 
        categoryFolders: [],
        categories: [],
        totalResults: 0 
      });
      return;
    }

    setSearchLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      
      const [regularSearch, categorySearch] = await Promise.all([
        axios.get(`${API_URL}/api/files/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${userData.token}` }
        }).catch(() => ({ 
          data: { results: { files: [], folders: [] }, totalResults: 0 } 
        })),
        
        axios.get(`${API_URL}/api/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${userData.token}` }
        }).catch((err) => {
          console.error('Category search error:', err.response?.data || err.message);
          return { 
            data: { results: { files: [], folders: [], categories: [] }, totalResults: 0 } 
          };
        })
      ]);

      const results: SearchResults = {
        files: regularSearch.data.results?.files || [],
        folders: regularSearch.data.results?.folders || [],
        categoryFiles: categorySearch.data.results?.files || [],
        categoryFolders: categorySearch.data.results?.folders || [],
        categories: categorySearch.data.results?.categories || [],
        totalResults: (regularSearch.data.totalResults || 0) + (categorySearch.data.totalResults || 0)
      };

      console.log('Search results:', results);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({ 
        files: [], 
        folders: [], 
        categoryFiles: [], 
        categoryFolders: [],
        categories: [],
        totalResults: 0 
      });
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        performSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSearchOpen(value.length > 0);
  };

  const saveRecentSearch = (query: string) => {
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const handleFileClick = (file: SearchFile) => {
    saveRecentSearch(file.file_name);
    setSearchOpen(false);
    setSearchQuery("");
    
    if (file.folder_id) {
      navigate(`/files?folder=${file.folder_id}&highlight=${file.id}`);
    } else {
      navigate(`/files?highlight=${file.id}`);
    }
  };

  const handleFolderClick = (folder: SearchFolder) => {
    saveRecentSearch(folder.name);
    setSearchOpen(false);
    setSearchQuery("");
    navigate(`/files?folder=${folder.id}`);
  };

  const handleCategoryFileClick = (file: CategoryFile) => {
    saveRecentSearch(file.name);
    setSearchOpen(false);
    setSearchQuery("");
    navigate(`/categories?category=${file.category_id}&folder=${file.folder_id || ''}&highlight=${file.id}`);
  };

  const handleCategoryClick = (category: Category) => {
    saveRecentSearch(category.name);
    setSearchOpen(false);
    setSearchQuery("");
    navigate(`/categories?category=${category.id}`);
  };

  const handleCategoryFolderClick = (folder: CategoryFolder) => {
    saveRecentSearch(folder.name);
    setSearchOpen(false);
    setSearchQuery("");
    navigate(`/categories?category=${folder.category_id}&folder=${folder.id}`);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchOpen(false);
    setSearchResults({ 
      files: [], 
      folders: [], 
      categoryFiles: [], 
      categoryFolders: [],
      categories: [],
      totalResults: 0 
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    const type = fileType?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type)) return '🖼️';
    if (['pdf'].includes(type)) return '📄';
    if (['doc', 'docx'].includes(type)) return '📝';
    if (['xls', 'xlsx'].includes(type)) return '📊';
    if (['zip', 'rar', '7z'].includes(type)) return '🗜️';
    if (['mp4', 'avi', 'mov'].includes(type)) return '🎥';
    if (['mp3', 'wav'].includes(type)) return '🎵';
    return '📄';
  };

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: Home },
    { path: "/files", label: "Files", icon: FileText },
    { path: "/categories", label: "Categories", icon: FolderOpen },
    { path: "/settings", label: "Settings", icon: Settings }
  ];

  const displayName = userData?.user?.name || "Unknown User";
  const displayEmail = userData?.user?.email || userData?.user?.user_name || "No email";
  const displayRole = userData?.user?.role || "User";
  const displayDepartment = userData?.user?.department || "";

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? "w-16" : "w-64"
        } bg-blue-700 text-white flex flex-col transition-all duration-300 ease-in-out relative z-50`}
      >
        <div className="p-4 border-b border-blue-600 flex items-center justify-between">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold">FileVault</div>
                <div className="text-xs text-blue-200">Intranet System</div>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mx-auto">
              <Building2 className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group relative ${
                  isActive(item.path)
                    ? "bg-blue-600 text-white shadow-sm"
                    : "hover:bg-blue-600/50 text-blue-100 hover:text-white"
                }`}
                title={sidebarCollapsed ? item.label : ""}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
                {sidebarCollapsed && (
                  <div className="absolute left-12 bg-gray-900 text-white px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="p-4 border-t border-blue-600">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white truncate">{displayName}</div>
                <div className="text-blue-200 text-xs truncate">
                  {displayDepartment ? `${displayRole} • ${displayDepartment}` : displayRole}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-6 relative z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? (
                <Menu className="w-5 h-5 text-gray-600" />
              ) : (
                <X className="w-5 h-5 text-gray-600" />
              )}
            </button>

            <div className="hidden md:block">
              <h1 className="text-xl font-semibold text-gray-900">
                NSCSL Intranet File Management System
              </h1>
              <p className="text-sm text-gray-500">
                Secure document collaboration platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Enhanced Search Bar */}
            <div className="hidden lg:flex relative" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search files, folders, categories..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery && setSearchOpen(true)}
                className="pl-10 pr-10 py-2 w-80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}

              {/* Search Dropdown */}
              {searchOpen && (
                <div className="absolute top-full mt-2 w-[500px] bg-white rounded-lg shadow-xl border border-gray-200 max-h-[600px] overflow-y-auto z-50">
                  {searchLoading ? (
                    <div className="p-8 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      <span className="ml-2 text-gray-600">Searching...</span>
                    </div>
                  ) : searchResults.totalResults === 0 && searchQuery ? (
                    <div className="p-8 text-center">
                      <p className="text-gray-500">No results found for "{searchQuery}"</p>
                      {recentSearches.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-400 mb-2">Recent searches:</p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {recentSearches.map((term, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSearchQuery(term)}
                                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
                              >
                                {term}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Categories Section */}
                      {searchResults.categories.length > 0 && (
                        <div className="border-b border-gray-100">
                          <div className="px-4 py-2 bg-gray-50 font-semibold text-xs text-gray-500 uppercase">
                            Categories ({searchResults.categories.length})
                          </div>
                          {searchResults.categories.map((category) => (
                            <button
                              key={`category-${category.id}`}
                              onClick={() => handleCategoryClick(category)}
                              className="w-full px-4 py-3 hover:bg-blue-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                            >
                              <FolderOpen className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 text-left">
                                <div className="font-medium text-gray-900">{category.name}</div>
                                {category.description && (
                                  <div className="text-xs text-gray-500 mt-1">{category.description}</div>
                                )}
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Category Folders Section */}
                      {searchResults.categoryFolders.length > 0 && (
                        <div className="border-b border-gray-100">
                          <div className="px-4 py-2 bg-gray-50 font-semibold text-xs text-gray-500 uppercase">
                            Category Folders ({searchResults.categoryFolders.length})
                          </div>
                          {searchResults.categoryFolders.map((folder) => (
                            <button
                              key={`cat-folder-${folder.id}`}
                              onClick={() => handleCategoryFolderClick(folder)}
                              className="w-full px-4 py-3 hover:bg-blue-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                            >
                              <Folder className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 text-left">
                                <div className="font-medium text-gray-900">{folder.name}</div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded">
                                    {folder.category_name}
                                  </span>
                                  <span>•</span>
                                  <span>by {folder.created_by_name}</span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Folders Section */}
                      {searchResults.folders.length > 0 && (
                        <div className="border-b border-gray-100">
                          <div className="px-4 py-2 bg-gray-50 font-semibold text-xs text-gray-500 uppercase">
                            Folders ({searchResults.folders.length})
                          </div>
                          {searchResults.folders.map((folder) => (
                            <button
                              key={`folder-${folder.id}`}
                              onClick={() => handleFolderClick(folder)}
                              className="w-full px-4 py-3 hover:bg-blue-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                            >
                              <Folder className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 text-left">
                                <div className="font-medium text-gray-900">{folder.name}</div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                  {folder.parent_folder_name && (
                                    <>
                                      <span>in {folder.parent_folder_name}</span>
                                      <span>•</span>
                                    </>
                                  )}
                                  <span>by {folder.created_by_name}</span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Regular Files Section */}
                      {searchResults.files.length > 0 && (
                        <div className="border-b border-gray-100">
                          <div className="px-4 py-2 bg-gray-50 font-semibold text-xs text-gray-500 uppercase">
                            Files ({searchResults.files.length})
                          </div>
                          {searchResults.files.map((file) => (
                            <button
                              key={`file-${file.id}`}
                              onClick={() => handleFileClick(file)}
                              className="w-full px-4 py-3 hover:bg-blue-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                            >
                              <div className="text-2xl flex-shrink-0">
                                {getFileIcon(file.file_type)}
                              </div>
                              <div className="flex-1 text-left">
                                <div className="font-medium text-gray-900">{file.file_name}</div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                  <span>{file.file_type?.toUpperCase()}</span>
                                  <span>•</span>
                                  <span>{formatFileSize(file.file_size)}</span>
                                  {file.folder_name && (
                                    <>
                                      <span>•</span>
                                      <span>in {file.folder_name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Category Files Section */}
                      {searchResults.categoryFiles.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-gray-50 font-semibold text-xs text-gray-500 uppercase">
                            Category Files ({searchResults.categoryFiles.length})
                          </div>
                          {searchResults.categoryFiles.map((file) => (
                            <button
                              key={`cat-file-${file.id}`}
                              onClick={() => handleCategoryFileClick(file)}
                              className="w-full px-4 py-3 hover:bg-blue-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                            >
                              <div className="text-2xl flex-shrink-0">
                                {getFileIcon(file.file_type)}
                              </div>
                              <div className="flex-1 text-left">
                                <div className="font-medium text-gray-900">{file.name}</div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded">
                                    {file.category_name}
                                  </span>
                                  <span>•</span>
                                  <span>{file.file_type?.toUpperCase()}</span>
                                  <span>•</span>
                                  <span>{formatFileSize(file.file_size)}</span>
                                  {file.folder_name && (
                                    <>
                                      <span>•</span>
                                      <span>in {file.folder_name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      {searchResults.totalResults > 0 && (
                        <div className="px-4 py-3 bg-gray-50 text-center text-xs text-gray-500">
                          Showing {searchResults.totalResults} result{searchResults.totalResults !== 1 ? 's' : ''}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* User Menu */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setUserDropdownOpen(!userDropdownOpen);
                }}
                className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-gray-900">{displayName}</div>
                  <div className="text-xs text-gray-500">{displayRole}</div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${userDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900">{displayName}</div>
                    <div className="text-xs text-gray-500">{displayEmail}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {displayDepartment ? `${displayRole} • ${displayDepartment}` : displayRole}
                    </div>
                  </div>
                             
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto bg-gray-50">
          <div className="max-w-full">
            {children}
          </div>
        </main>
      </div>

      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
}