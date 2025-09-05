import React, { useState } from 'react';
import {
  Search,
  Plus,
  FolderOpen,
  FileText,
  Users,
  BookOpen,
  ClipboardList,
  BarChart3,
  Shield,
  Briefcase,
  GraduationCap,
  Heart,
  Settings,
  MoreHorizontal,
  Edit3,
  Trash2,
  Eye,
  Filter,
  Grid3X3,
  List
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description: string;
  fileCount: number;
  icon: any;
  color: string;
  bgColor: string;
  lastUpdated: Date;
  createdBy: string;
}

const Categories: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Mock categories data
  const categories: Category[] = [
    {
      id: '1',
      name: 'Employee Manuals',
      description: 'Company policies, procedures, and employee handbooks',
      fileCount: 24,
      icon: BookOpen,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      lastUpdated: new Date('2024-01-15'),
      createdBy: 'HR Department'
    },
    {
      id: '2',
      name: 'Forms & Applications',
      description: 'Request forms, applications, and official documents',
      fileCount: 36,
      icon: ClipboardList,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      lastUpdated: new Date('2024-01-12'),
      createdBy: 'Admin'
    },
    {
      id: '3',
      name: 'Financial Reports',
      description: 'Budget reports, financial statements, and analysis',
      fileCount: 18,
      icon: BarChart3,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      lastUpdated: new Date('2024-01-10'),
      createdBy: 'Finance Team'
    },
    {
      id: '4',
      name: 'IT Documentation',
      description: 'Technical guides, system documentation, and IT policies',
      fileCount: 42,
      icon: Settings,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      lastUpdated: new Date('2024-01-08'),
      createdBy: 'IT Department'
    },
    {
      id: '5',
      name: 'Security & Compliance',
      description: 'Security protocols, compliance documents, and certifications',
      fileCount: 15,
      icon: Shield,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      lastUpdated: new Date('2024-01-05'),
      createdBy: 'Security Team'
    },
    {
      id: '6',
      name: 'Project Documents',
      description: 'Project plans, specifications, and deliverables',
      fileCount: 67,
      icon: Briefcase,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      lastUpdated: new Date('2024-01-14'),
      createdBy: 'Project Manager'
    },
    {
      id: '7',
      name: 'Training Materials',
      description: 'Training guides, presentations, and learning resources',
      fileCount: 29,
      icon: GraduationCap,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      lastUpdated: new Date('2024-01-11'),
      createdBy: 'Training Team'
    },
    {
      id: '8',
      name: 'HR Documents',
      description: 'Personnel files, benefits information, and HR policies',
      fileCount: 33,
      icon: Users,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      lastUpdated: new Date('2024-01-09'),
      createdBy: 'HR Department'
    }
  ];

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleCategoryClick = (categoryId: string) => {
    // Navigate to files page with category filter
    // You can implement this with your routing logic
    console.log('Navigate to files with category:', categoryId);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Categories</h1>
          <p className="text-gray-600">Organize and access your files by category</p>
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
                  placeholder="Search categories..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
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
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            </div>
          </div>
        </div>

        {/* Categories Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FolderOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Categories</div>
                <div className="text-xl font-bold text-gray-900">{categories.length}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Files</div>
                <div className="text-xl font-bold text-gray-900">
                  {categories.reduce((sum, cat) => sum + cat.fileCount, 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Avg Files/Category</div>
                <div className="text-xl font-bold text-gray-900">
                  {Math.round(categories.reduce((sum, cat) => sum + cat.fileCount, 0) / categories.length)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Active Users</div>
                <div className="text-xl font-bold text-gray-900">24</div>
              </div>
            </div>
          </div>
        </div>

        {/* Categories Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {viewMode === 'grid' ? (
            /* Grid View */
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <div
                      key={category.id}
                      onClick={() => handleCategoryClick(category.id)}
                      className="group cursor-pointer bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 ${category.bgColor} rounded-lg`}>
                          <Icon className={`w-6 h-6 ${category.color}`} />
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all">
                          <MoreHorizontal className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>

                      <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {category.name}
                      </h3>
                      
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {category.description}
                      </p>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1 text-gray-500">
                          <FileText className="w-4 h-4" />
                          <span>{category.fileCount} files</span>
                        </div>
                        <div className="text-gray-400">
                          {formatDate(category.lastUpdated)}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500">
                          Created by <span className="font-medium">{category.createdBy}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* List View */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-700">Category</th>
                    <th className="text-left p-4 font-medium text-gray-700">Description</th>
                    <th className="text-left p-4 font-medium text-gray-700">Files</th>
                    <th className="text-left p-4 font-medium text-gray-700">Last Updated</th>
                    <th className="text-left p-4 font-medium text-gray-700">Created By</th>
                    <th className="w-12 p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCategories.map((category) => {
                    const Icon = category.icon;
                    return (
                      <tr
                        key={category.id}
                        onClick={() => handleCategoryClick(category.id)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 ${category.bgColor} rounded-lg`}>
                              <Icon className={`w-5 h-5 ${category.color}`} />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{category.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-600 max-w-xs truncate">
                          {category.description}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {category.fileCount} files
                          </span>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {formatDate(category.lastUpdated)}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {category.createdBy}
                        </td>
                        <td className="p-4">
                          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                            <MoreHorizontal className="w-4 h-4 text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Empty State */}
        {filteredCategories.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery ? 'Try adjusting your search terms.' : 'Create your first category to organize your files.'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>
        )}

        {/* Add Category Modal Placeholder */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Category</h3>
              <p className="text-gray-600 mb-4">
                This would be a form to create a new category. You can implement the full form here.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Category
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Categories;