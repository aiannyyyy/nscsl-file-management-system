import React, { useState, useMemo } from 'react';
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
  Home
} from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  fileType?: string;
  modifiedAt: Date;
  modifiedBy: string;
  isStarred: boolean;
  thumbnail?: string;
}

interface BreadcrumbItem {
  name: string;
  path: string;
}

const Files: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Mock data
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', path: '/' },
    { name: 'Documents', path: '/documents' },
    { name: 'Projects', path: '/documents/projects' }
  ];

  const files: FileItem[] = [
    {
      id: '1',
      name: 'Project Proposal',
      type: 'folder',
      modifiedAt: new Date('2024-01-15'),
      modifiedBy: 'John Doe',
      isStarred: true
    },
    {
      id: '2',
      name: 'Marketing Materials',
      type: 'folder',
      modifiedAt: new Date('2024-01-10'),
      modifiedBy: 'Sarah Smith',
      isStarred: false
    },
    {
      id: '3',
      name: 'Budget Report Q4.pdf',
      type: 'file',
      fileType: 'pdf',
      size: 2456789,
      modifiedAt: new Date('2024-01-12'),
      modifiedBy: 'Mike Johnson',
      isStarred: false
    },
    {
      id: '4',
      name: 'Team Photo.jpg',
      type: 'file',
      fileType: 'image',
      size: 1234567,
      modifiedAt: new Date('2024-01-08'),
      modifiedBy: 'Alice Brown',
      isStarred: true
    },
    {
      id: '5',
      name: 'Meeting Notes.docx',
      type: 'file',
      fileType: 'document',
      size: 567890,
      modifiedAt: new Date('2024-01-14'),
      modifiedBy: 'David Wilson',
      isStarred: false
    },
    {
      id: '6',
      name: 'Archive',
      type: 'folder',
      modifiedAt: new Date('2024-01-05'),
      modifiedBy: 'System Admin',
      isStarred: false
    }
  ];

  const filteredAndSortedFiles = useMemo(() => {
    let filtered = files.filter(file =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filtered.sort((a, b) => {
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
  }, [files, searchQuery, sortBy, sortOrder]);

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
      case 'image':
        return <Image className="w-5 h-5 text-green-500" />;
      case 'document':
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Files</h1>
          
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex items-center">
                {index === 0 && <Home className="w-4 h-4 mr-1" />}
                <button className="hover:text-blue-600 transition-colors">
                  {crumb.name}
                </button>
                {index < breadcrumbs.length - 1 && (
                  <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                )}
              </div>
            ))}
          </nav>
        </div>

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
              
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Upload className="w-4 h-4" />
                Upload
              </button>
              
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
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
                <button className="flex items-center gap-2 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100 rounded-md transition-colors">
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button className="flex items-center gap-2 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100 rounded-md transition-colors">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                <button className="flex items-center gap-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Files Content */}
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
                            setSelectedFiles(files.map(f => f.id));
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
                    <th className="w-12 p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAndSortedFiles.map((file) => (
                    <tr
                      key={file.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        selectedFiles.includes(file.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="p-3">
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
                      <td className="p-3">
                        <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                          <MoreHorizontal className="w-4 h-4 text-gray-400" />
                        </button>
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
                    onClick={() => toggleFileSelection(file.id)}
                  >
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <MoreHorizontal className="w-4 h-4 text-gray-400" />
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {filteredAndSortedFiles.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <File className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery ? 'Try adjusting your search terms.' : 'Upload your first file to get started.'}
            </p>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto">
              <Upload className="w-4 h-4" />
              Upload Files
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Files;