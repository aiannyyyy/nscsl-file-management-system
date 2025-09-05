import React from 'react';
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
  User
} from 'lucide-react';

export default function Dashboard() {
  // Mock data for recent activities
  const recentActivities = [
    {
      id: 1,
      user: 'John Doe',
      action: 'uploaded',
      file: 'Project Proposal.pdf',
      time: '2 minutes ago',
      type: 'upload'
    },
    {
      id: 2,
      user: 'Sarah Smith',
      action: 'shared',
      file: 'Marketing Presentation.pptx',
      time: '15 minutes ago',
      type: 'share'
    },
    {
      id: 3,
      user: 'Mike Johnson',
      action: 'downloaded',
      file: 'Budget Report Q4.xlsx',
      time: '1 hour ago',
      type: 'download'
    },
    {
      id: 4,
      user: 'Alice Brown',
      action: 'created folder',
      file: 'Team Photos',
      time: '2 hours ago',
      type: 'folder'
    },
    {
      id: 5,
      user: 'David Wilson',
      action: 'uploaded',
      file: 'Meeting Notes.docx',
      time: '3 hours ago',
      type: 'upload'
    }
  ];

  // Mock data for popular files
  const popularFiles = [
    {
      id: 1,
      name: 'Company Handbook.pdf',
      downloads: 145,
      type: 'pdf',
      size: '2.1 MB'
    },
    {
      id: 2,
      name: 'Team Directory.xlsx',
      downloads: 89,
      type: 'spreadsheet',
      size: '856 KB'
    },
    {
      id: 3,
      name: 'Brand Guidelines.zip',
      downloads: 67,
      type: 'archive',
      size: '15.3 MB'
    },
    {
      id: 4,
      name: 'Project Template.docx',
      downloads: 52,
      type: 'document',
      size: '1.2 MB'
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'upload':
        return <Upload className="w-4 h-4 text-blue-500" />;
      case 'download':
        return <Download className="w-4 h-4 text-green-500" />;
      case 'share':
        return <Share2 className="w-4 h-4 text-purple-500" />;
      case 'folder':
        return <Folder className="w-4 h-4 text-yellow-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'spreadsheet':
        return <FileText className="w-5 h-5 text-green-500" />;
      case 'document':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'archive':
        return <File className="w-5 h-5 text-purple-500" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">📊 Dashboard</h2>
        <p className="text-gray-600">Welcome back! Here's what's happening with your files today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Files Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Total Files</h3>
              <p className="text-2xl font-bold mt-2 text-gray-900">1,245</p>
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-600 font-medium">+12%</span>
                <span className="text-gray-500 ml-1">from last month</span>
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
              <p className="text-2xl font-bold mt-2 text-gray-900">32 GB</p>
              <div className="flex items-center mt-2 text-sm">
                <span className="text-gray-500">of 100 GB</span>
              </div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: '32%' }}></div>
              </div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <HardDrive className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Active Users Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Active Users</h3>
              <p className="text-2xl font-bold mt-2 text-gray-900">18</p>
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-600 font-medium">+3</span>
                <span className="text-gray-500 ml-1">this week</span>
              </div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Files Shared Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Files Shared</h3>
              <p className="text-2xl font-bold mt-2 text-gray-900">247</p>
              <div className="flex items-center mt-2 text-sm">
                <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                <span className="text-red-600 font-medium">-5%</span>
                <span className="text-gray-500 ml-1">from last week</span>
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Share2 className="w-6 h-6 text-purple-600" />
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
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-sm font-medium text-gray-700">Documents</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">12.5 GB</div>
                <div className="text-xs text-gray-500">39%</div>
              </div>
            </div>
            <div className="bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '39%' }}></div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm font-medium text-gray-700">Images</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">8.7 GB</div>
                <div className="text-xs text-gray-500">27%</div>
              </div>
            </div>
            <div className="bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: '27%' }}></div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                <span className="text-sm font-medium text-gray-700">Videos</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">6.4 GB</div>
                <div className="text-xs text-gray-500">20%</div>
              </div>
            </div>
            <div className="bg-gray-200 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full" style={{ width: '20%' }}></div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span className="text-sm font-medium text-gray-700">Others</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">4.4 GB</div>
                <div className="text-xs text-gray-500">14%</div>
              </div>
            </div>
            <div className="bg-gray-200 rounded-full h-2">
              <div className="bg-orange-500 h-2 rounded-full" style={{ width: '14%' }}></div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Upload className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Upload Files</div>
                <div className="text-sm text-gray-500">Add new documents</div>
              </div>
            </button>

            <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
              <div className="p-2 bg-green-50 rounded-lg">
                <Folder className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Create Folder</div>
                <div className="text-sm text-gray-500">Organize your files</div>
              </div>
            </button>

            <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Share2 className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Share Files</div>
                <div className="text-sm text-gray-500">Collaborate with team</div>
              </div>
            </button>

            <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
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

      {/* Recent Activity and Popular Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View All
            </button>
          </div>
          
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="p-1 bg-gray-50 rounded-full mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900">
                    <span className="font-medium">{activity.user}</span> {activity.action}{' '}
                    <span className="font-medium">{activity.file}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {activity.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Popular Files */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Popular Files</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View All
            </button>
          </div>
          
          <div className="space-y-4">
            {popularFiles.map((file, index) => (
              <div key={file.id} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {file.downloads} downloads • {file.size}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="text-sm font-bold text-blue-600">
                    #{index + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}