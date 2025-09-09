import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  Upload, 
  FolderPlus, 
  MoreHorizontal,
  File,
  Folder,
  Image,
  FileText,
  Download,
  Share2,
  Trash2,
  Star,
  Clock,
  User,
  Calendar,
  ArrowUpDown,
  ChevronRight,
  Home,
  X,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface FileItem {
  id: string;
  folder_id?: string;
  file_name?: string;
  name?: string;
  file_path?: string;
  file_type?: string;
  file_size?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  created_by_name?: string;
  updated_by_name?: string;
  type: 'file' | 'folder';
  size?: number;
  fileType?: string;
  modifiedAt: Date;
  modifiedBy: string;
  isStarred: boolean;
  thumbnail?: string;
}

interface FolderItem {
  id: string;
  name: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name?: string;
  updated_by_name?: string;
  type: 'folder';
}

interface BreadcrumbItem {
  name: string;
  path: string;
  id?: string;
}

interface ApiResponse {
  folders: FolderItem[];
  files: FileItem[];
}

// Add this interface at the top of your Files component
interface User {
  id?: string | number;
  name: string;
  user_name: string;
  department?: string;
  role: string;
}

interface FilesProps {
  currentUser: User;
}


const Files: React.FC<FilesProps> = ({ currentUser }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderPath, setFolderPath] = useState<BreadcrumbItem[]>([{ name: 'Home', path: '/', id: null }]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);


  // Replace the hardcoded user ID with the actual current user ID
  const CURRENT_USER_ID = currentUser.id?.toString() || '1'; // Fallback to '1' if id is missing

  // Add some logging to verify the user ID
  console.log('Current user in Files component:', currentUser);
  console.log('Using user ID:', CURRENT_USER_ID);

  // API base URL - adjust this to match your backend
  const API_BASE = 'http://localhost:3002/api/files';

  // Auto-hide messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Load files and folders
  useEffect(() => {
    loadFilesAndFolders();
  }, [currentFolder]);

  const loadFilesAndFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = currentFolder 
        ? `${API_BASE}/list/${currentFolder}` 
        : `${API_BASE}/list`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load files');
      
      const data: ApiResponse = await response.json();
      
      // Transform backend data to match frontend interface
      const transformedFiles: FileItem[] = data.files.map(file => ({
        ...file,
        id: file.id,
        name: file.file_name || file.name || '',
        type: 'file' as const,
        size: file.file_size,
        fileType: file.file_type,
        modifiedAt: new Date(file.updated_at || file.created_at || Date.now()),
        modifiedBy: file.updated_by_name || file.created_by_name || 'Unknown',
        isStarred: false, // You can add this to your DB schema if needed
      }));

      const transformedFolders: FolderItem[] = data.folders.map(folder => ({
        ...folder,
        modifiedAt: new Date(folder.updated_at || folder.created_at),
        modifiedBy: folder.updated_by_name || folder.created_by_name || 'Unknown',
        isStarred: false
      }));

      setFiles(transformedFiles);
      setFolders(transformedFolders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Combined files and folders for display
  const allItems = useMemo(() => {
    const folderItems: FileItem[] = folders.map(folder => ({
      ...folder,
      id: folder.id,
      name: folder.name,
      type: 'folder' as const,
      modifiedAt: new Date(folder.updated_at || folder.created_at),
      modifiedBy: folder.updated_by_name || folder.created_by_name || 'Unknown',
      isStarred: false
    }));

    return [...folderItems, ...files];
  }, [files, folders]);

  const filteredAndSortedFiles = useMemo(() => {
    let filtered = allItems.filter(file =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort folders first, then files
    filtered.sort((a, b) => {
      // Folders always come first
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      
      let comparison = 0;
      
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'date') {
        comparison = a.modifiedAt.getTime() - b.modifiedAt.getTime();
      } else if (sortBy === 'size') {
        comparison = (a.size || 0) - (b.size || 0);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allItems, searchQuery, sortBy, sortOrder]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    if (currentFolder) {
      formData.append('folder_id', currentFolder);
    }
    formData.append('created_by', CURRENT_USER_ID);

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      setSuccess(`File "${uploadFile.name}" uploaded successfully!`);
      
      setShowUploadModal(false);
      setUploadFile(null);
      loadFilesAndFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      const response = await fetch(`${API_BASE}/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parent_id: currentFolder,
          created_by: CURRENT_USER_ID
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create folder');
      }

      const result = await response.json();
      setSuccess(`Folder "${newFolderName}" created successfully!`);
      
      setShowFolderModal(false);
      setNewFolderName('');
      loadFilesAndFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await fetch(`${API_BASE}/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          updated_by: CURRENT_USER_ID
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete item');
      }

      const result = await response.json();
      setSuccess('Item deleted successfully!');
      setSelectedFiles(prev => prev.filter(id => id !== itemId));
      loadFilesAndFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const handleDownload = async (file: FileItem) => {
    if (file.type === 'folder') return;

    try {
      const response = await fetch(`${API_BASE}/download/${file.id}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleFolderClick = (folder: FileItem) => {
    if (folder.type !== 'folder') return;
    
    setCurrentFolder(folder.id);
    setFolderPath(prev => [...prev, { name: folder.name, path: folder.id, id: folder.id }]);
  };

  const handleBreadcrumbClick = (item: BreadcrumbItem) => {
    const index = folderPath.findIndex(p => p.path === item.path);
    if (index !== -1) {
      setFolderPath(folderPath.slice(0, index + 1));
      setCurrentFolder(item.id || null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'folder') {
      return <Folder className="w-5 h-5 text-blue-500" />;
    }
    
    switch (file.fileType) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <Image className="w-5 h-5 text-green-500" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="w-5 h-5 text-blue-500" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleSort = (column: 'name' | 'date' | 'size') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'folder') {
      handleFolderClick(item);
    } else {
      // For files, you might want to open a preview or download
      console.log('File clicked:', item);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Files</h1>
          
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
            {folderPath.map((crumb, index) => (
              <div key={crumb.path} className="flex items-center">
                {index === 0 && <Home className="w-4 h-4 mr-1" />}
                <button 
                  className="hover:text-blue-600 transition-colors"
                  onClick={() => handleBreadcrumbClick(crumb)}
                >
                  {crumb.name}
                </button>
                {index < folderPath.length - 1 && (
                  <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-700">{success}</span>
            <button 
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-500 hover:text-green-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search and Filter */}
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search files and folders..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${
                  showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'text-gray-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>

            {/* View Controls and Actions */}
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => setShowUploadModal(true)}
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
              
              <button 
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setShowFolderModal(true)}
              >
                <FolderPlus className="w-4 h-4" />
                New Folder
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-4">
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option>All Types</option>
                  <option>Folders</option>
                  <option>Documents</option>
                  <option>Images</option>
                  <option>PDFs</option>
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option>All Time</option>
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                  <option>Last 3 months</option>
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option>All Sizes</option>
                  <option>Less than 1MB</option>
                  <option>1MB - 10MB</option>
                  <option>More than 10MB</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Selection Actions */}
        {selectedFiles.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-blue-700 font-medium">
                {selectedFiles.length} item{selectedFiles.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <button 
                  className="flex items-center gap-2 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100 rounded-md transition-colors"
                  onClick={() => {
                    selectedFiles.forEach(id => {
                      const item = allItems.find(f => f.id === id);
                      if (item && item.type === 'file') {
                        handleDownload(item);
                      }
                    });
                  }}
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button className="flex items-center gap-2 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100 rounded-md transition-colors">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                <button 
                  className="flex items-center gap-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  onClick={() => {
                    selectedFiles.forEach(id => handleDelete(id));
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Files Content */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading files...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {viewMode === 'list' ? (
              /* List View */
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="w-8 p-3">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFiles(filteredAndSortedFiles.map(f => f.id));
                            } else {
                              setSelectedFiles([]);
                            }
                          }}
                        />
                      </th>
                      <th className="text-left p-3">
                        <button
                          onClick={() => handleSort('name')}
                          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                        >
                          Name
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left p-3">
                        <button
                          onClick={() => handleSort('date')}
                          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                        >
                          Modified
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-left p-3">
                        <button
                          onClick={() => handleSort('size')}
                          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                        >
                          Size
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="w-12 p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAndSortedFiles.map((file) => (
                      <tr
                        key={file.id}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                          selectedFiles.includes(file.id) ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => handleItemClick(file)}
                      >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(file.id)}
                            onChange={() => toggleFileSelection(file.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {getFileIcon(file)}
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{file.name}</span>
                              {file.isStarred && <Star className="w-4 h-4 text-yellow-400 fill-current" />}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDate(file.modifiedAt)}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <User className="w-4 h-4 text-gray-400" />
                            {file.modifiedBy}
                          </div>
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {file.size ? formatFileSize(file.size) : '-'}
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {file.type === 'file' && (
                              <button 
                                onClick={() => handleDownload(file)}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4 text-gray-400" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDelete(file.id)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid View */
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {filteredAndSortedFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`relative group p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all cursor-pointer ${
                        selectedFiles.includes(file.id) ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                      }`}
                      onClick={() => handleItemClick(file)}
                    >
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        {file.type === 'file' && (
                          <button 
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                            title="Download"
                          >
                            <Download className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                        <button 
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(file.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                      
                      <div className="absolute top-2 left-2">
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.id)}
                          onChange={() => toggleFileSelection(file.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 mb-3 flex items-center justify-center">
                          {file.type === 'folder' ? (
                            <Folder className="w-10 h-10 text-blue-500" />
                          ) : (
                            <div className="relative">
                              {getFileIcon(file)}
                              <div className="absolute -top-1 -right-1">
                                {file.isStarred && <Star className="w-3 h-3 text-yellow-400 fill-current" />}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <h3 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2 leading-tight">
                          {file.name}
                        </h3>
                        
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(file.modifiedAt)}
                          </div>
                          {file.size && (
                            <div>{formatFileSize(file.size)}</div>
                          )}
                        </div>

                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <User className="w-3 h-3" />
                            {currentUser.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAndSortedFiles.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <File className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery ? 'Try adjusting your search terms.' : 'Upload your first file to get started.'}
            </p>
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
              onClick={() => setShowUploadModal(true)}
            >
              <Upload className="w-4 h-4" />
              Upload Files
            </button>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Upload File</h3>
                <button 
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={isUploading}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select File
                  </label>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isUploading}
                  />
                  {uploadFile && (
                    <p className="mt-2 text-sm text-gray-600">
                      Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!uploadFile || isUploading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Folder Modal */}
        {showFolderModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Create New Folder</h3>
                <button 
                  onClick={() => {
                    setShowFolderModal(false);
                    setNewFolderName('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={isCreatingFolder}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newFolderName.trim() && !isCreatingFolder) {
                        handleCreateFolder();
                      }
                    }}
                    disabled={isCreatingFolder}
                  />
                </div>
                
                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowFolderModal(false);
                      setNewFolderName('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={isCreatingFolder}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || isCreatingFolder}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreatingFolder ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <FolderPlus className="w-4 h-4" />
                        Create
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Files;