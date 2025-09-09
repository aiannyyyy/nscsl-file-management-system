import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Users,
  HardDrive,
  Upload,
  Download,
  Share2,
  TrendingUp,
  TrendingDown,
  Clock,
  Star,
  Folder,
  Image,
  File,
  MoreHorizontal,
  Activity,
  Calendar,
  User,
  FolderPlus
} from 'lucide-react';

interface User {
  id?: string | number;
  name: string;
  user_name: string;
  department?: string;
  role: string;
}

interface DashboardProps {
  currentUser: User;
}

interface DashboardStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  totalSizeFormatted: string;
  fileTypes: Array<{
    file_type: string;
    count: number;
    total_size: number;
  }>;
}

interface RecentActivity {
  id: string;
  user_name: string;
  action: string;
  file_name: string;
  created_at: string;
  type: 'file' | 'folder';
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = 'http://localhost:3002/api/files';

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load statistics
      const statsResponse = await fetch(`${API_BASE}/stats`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Load recent files and folders (as activity)
      const filesResponse = await fetch(`${API_BASE}/list`);
      if (filesResponse.ok) {
        const data = await filesResponse.json();
        
        // Combine files and folders for recent activity
        const allItems = [
          ...data.files.map((file: any) => ({
            id: file.id,
            user_name: file.created_by_name || 'Unknown',
            action: 'uploaded',
            file_name: file.file_name,
            created_at: file.created_at,
            type: 'file' as const
          })),
          ...data.folders.map((folder: any) => ({
            id: folder.id,
            user_name: folder.created_by_name || 'Unknown',
            action: 'created',
            file_name: folder.name,
            created_at: folder.created_at,
            type: 'folder' as const
          }))
        ];

        // Sort by creation date and take the 5 most recent
        const sortedActivities = allItems
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5);

        setRecentActivities(sortedActivities);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string, action: string) => {
    if (action === 'created' || type === 'folder') {
      return <Folder className="w-4 h-4 text-yellow-500" />;
    }
    return <Upload className="w-4 h-4 text-blue-500" />;
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'xlsx':
      case 'xls':
        return <FileText className="w-5 h-5 text-green-500" />;
      case 'docx':
      case 'doc':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'zip':
      case 'rar':
        return <File className="w-5 h-5 text-purple-500" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'upload':
      case 'folder':
      case 'share':
        navigate('/files');
        break;
      case 'reports':
        // You can add a reports page later
        console.log('Reports feature coming soon');
        break;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-xl h-32"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
        <p className="text-gray-600">
          Welcome back, {currentUser.name}! Here's what's happening with your files today.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Files Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Total Files</h3>
              <p className="text-2xl font-bold mt-2 text-gray-900">
                {stats?.totalFiles || 0}
              </p>
              <div className="flex items-center mt-2 text-sm">
                <span className="text-gray-500">Files in system</span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Storage Used Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Storage Used</h3>
              <p className="text-2xl font-bold mt-2 text-gray-900">
                {stats?.totalSizeFormatted || '0 Bytes'}
              </p>
              <div className="flex items-center mt-2 text-sm">
                <span className="text-gray-500">Total storage</span>
              </div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <HardDrive className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Total Folders Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Total Folders</h3>
              <p className="text-2xl font-bold mt-2 text-gray-900">
                {stats?.totalFolders || 0}
              </p>
              <div className="flex items-center mt-2 text-sm">
                <span className="text-gray-500">Folders created</span>
              </div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Folder className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* File Types Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">File Types</h3>
              <p className="text-2xl font-bold mt-2 text-gray-900">
                {stats?.fileTypes?.length || 0}
              </p>
              <div className="flex items-center mt-2 text-sm">
                <span className="text-gray-500">Different types</span>
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <File className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Storage Usage Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Storage Usage by Type</h3>
            <button className="text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
          
          {stats?.fileTypes && stats.fileTypes.length > 0 ? (
            <div className="space-y-4">
              {stats.fileTypes.slice(0, 5).map((fileType, index) => {
                const percentage = stats.totalSize > 0 
                  ? Math.round((fileType.total_size / stats.totalSize) * 100) 
                  : 0;
                const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500'];
                
                return (
                  <div key={fileType.file_type}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 ${colors[index % colors.length]} rounded`}></div>
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {fileType.file_type || 'Unknown'} Files
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatFileSize(fileType.total_size)}
                        </div>
                        <div className="text-xs text-gray-500">{percentage}%</div>
                      </div>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className={`${colors[index % colors.length]} h-2 rounded-full`} 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <File className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No file data available</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={() => handleQuickAction('upload')}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="p-2 bg-blue-50 rounded-lg">
                <Upload className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Upload Files</div>
                <div className="text-sm text-gray-500">Add new documents</div>
              </div>
            </button>

            <button 
              onClick={() => handleQuickAction('folder')}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="p-2 bg-green-50 rounded-lg">
                <FolderPlus className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Create Folder</div>
                <div className="text-sm text-gray-500">Organize your files</div>
              </div>
            </button>

            <button 
              onClick={() => handleQuickAction('share')}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="p-2 bg-purple-50 rounded-lg">
                <Share2 className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Manage Files</div>
                <div className="text-sm text-gray-500">Go to file manager</div>
              </div>
            </button>

            <button 
              onClick={() => handleQuickAction('reports')}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="p-2 bg-orange-50 rounded-lg">
                <Activity className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">View Reports</div>
                <div className="text-sm text-gray-500">Analyze usage data</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <button 
              onClick={() => navigate('/files')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All Files
            </button>
          </div>
          
          {recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={`${activity.type}-${activity.id}`} className="flex items-start gap-3">
                  <div className="p-1 bg-gray-50 rounded-full mt-1">
                    {getActivityIcon(activity.type, activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user_name}</span> {activity.action}{' '}
                      {activity.type === 'folder' ? 'folder' : 'file'}{' '}
                      <span className="font-medium">{activity.file_name}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(activity.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No recent activity</p>
              <button 
                onClick={() => navigate('/files')}
                className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                Upload your first file
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}