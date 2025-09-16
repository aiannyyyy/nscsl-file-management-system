import React, { useState, useEffect } from 'react';
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
  Edit3,
  Trash2,
  Grid3X3,
  List,
  X,
  AlertCircle,
  Loader
} from 'lucide-react';

// Icon mapping for categories
const iconOptions = {
  BookOpen,
  ClipboardList,
  BarChart3,
  Settings,
  Shield,
  Briefcase,
  GraduationCap,
  Users,
  Heart,
  FolderOpen,
  FileText
};

interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
  created_by: number;
  created_by_name?: string;
  updated_by?: number;
  updated_by_name?: string;
  created_at: string;
  updated_at: string;
}

interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
}

interface User {
  id?: string | number;
  name: string;
  user_name: string;
  email: string;
  department?: string;
  role: string;
}

interface CategoriesProps {
  currentUser: User;
}


const Categories: React.FC<CategoriesProps> = ({ currentUser }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'delete'>('add');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: '#007bff',
    icon: 'FolderOpen',
    is_active: true
  });
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Get current user ID with proper fallback
  const CURRENT_USER_ID = currentUser.id?.toString() || '1';

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3002/api/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleCategoryClick = (categoryId: number) => {
    // Navigate to files/folders page with category filter
    console.log('Navigate to files with category:', categoryId);
    // Example: router.push(`/files?category=${categoryId}`)
  };

  const openModal = (mode: 'add' | 'edit' | 'delete', category?: Category) => {
    setModalMode(mode);
    setSelectedCategory(category || null);
    
    if (mode === 'add') {
      setFormData({
        name: '',
        description: '',
        color: '#007bff',
        icon: 'FolderOpen',
        is_active: true
      });
    } else if (mode === 'edit' && category) {
      setFormData({
        name: category.name,
        description: category.description,
        color: category.color,
        icon: category.icon,
        is_active: category.is_active
      });
    }
    
    setShowModal(true);
    setError('');
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCategory(null);
    setError('');
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let response;
      
      if (modalMode === 'add') {
        response = await fetch('http://localhost:3002/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            created_by: CURRENT_USER_ID
          })
        });
      } else if (modalMode === 'edit' && selectedCategory) {
        response = await fetch(`/api/categories/${selectedCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            updated_by: CURRENT_USER_ID
          })
        });
      }

      if (!response?.ok) {
        const errorData = await response?.json();
        throw new Error(errorData?.error || 'Operation failed');
      }

      await fetchCategories();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`http://localhost:3002/api/categories/${selectedCategory.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted_by: CURRENT_USER_ID })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || 'Failed to delete category');
      }

      await fetchCategories();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setSubmitting(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    return iconOptions[iconName as keyof typeof iconOptions] || FolderOpen;
  };

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { text: string; bg: string }> = {
      '#007bff': { text: 'text-blue-600', bg: 'bg-blue-50' },
      '#28a745': { text: 'text-green-600', bg: 'bg-green-50' },
      '#dc3545': { text: 'text-red-600', bg: 'bg-red-50' },
      '#ffc107': { text: 'text-yellow-600', bg: 'bg-yellow-50' },
      '#6f42c1': { text: 'text-purple-600', bg: 'bg-purple-50' },
      '#fd7e14': { text: 'text-orange-600', bg: 'bg-orange-50' },
      '#20c997': { text: 'text-teal-600', bg: 'bg-teal-50' },
      '#e83e8c': { text: 'text-pink-600', bg: 'bg-pink-50' },
      '#6c757d': { text: 'text-gray-600', bg: 'bg-gray-50' },
    };
    
    return colorMap[color] || { text: 'text-blue-600', bg: 'bg-blue-50' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

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
            {/* Search */}
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
                onClick={() => openModal('add')}
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
                <div className="text-sm text-gray-500">Active Categories</div>
                <div className="text-xl font-bold text-gray-900">
                  {categories.filter(cat => cat.is_active).length}
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
                <div className="text-sm text-gray-500">Recent Updates</div>
                <div className="text-xl font-bold text-gray-900">
                  {categories.filter(cat => {
                    const daysSinceUpdate = Math.floor((Date.now() - new Date(cat.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                    return daysSinceUpdate <= 7;
                  }).length}
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
                <div className="text-sm text-gray-500">Contributors</div>
                <div className="text-xl font-bold text-gray-900">
                  {new Set(categories.map(cat => cat.created_by)).size}
                </div>
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
                  const Icon = getIconComponent(category.icon);
                  const colorClasses = getColorClasses(category.color);
                  return (
                    <div
                      key={category.id}
                      className="group bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div 
                          className={`p-3 ${colorClasses.bg} rounded-lg cursor-pointer`}
                          onClick={() => handleCategoryClick(category.id)}
                        >
                          <Icon className={`w-6 h-6 ${colorClasses.text}`} />
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openModal('edit', category)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-gray-400 hover:text-blue-600" />
                          </button>
                          <button
                            onClick={() => openModal('delete', category)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
                          </button>
                        </div>
                      </div>

                      <h3 
                        className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors cursor-pointer"
                        onClick={() => handleCategoryClick(category.id)}
                      >
                        {category.name}
                      </h3>
                      
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {category.description}
                      </p>

                      <div className="flex items-center justify-between text-sm mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            category.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {category.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="text-gray-400">
                          {formatDate(category.updated_at)}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500">
                          Created by <span className="font-medium">{category.created_by_name || 'Unknown'}</span>
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
                    <th className="text-left p-4 font-medium text-gray-700">Status</th>
                    <th className="text-left p-4 font-medium text-gray-700">Last Updated</th>
                    <th className="text-left p-4 font-medium text-gray-700">Created By</th>
                    <th className="w-12 p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCategories.map((category) => {
                    const Icon = getIconComponent(category.icon);
                    const colorClasses = getColorClasses(category.color);
                    return (
                      <tr
                        key={category.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className={`p-2 ${colorClasses.bg} rounded-lg cursor-pointer`}
                              onClick={() => handleCategoryClick(category.id)}
                            >
                              <Icon className={`w-5 h-5 ${colorClasses.text}`} />
                            </div>
                            <div>
                              <div 
                                className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer"
                                onClick={() => handleCategoryClick(category.id)}
                              >
                                {category.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-600 max-w-xs truncate">
                          {category.description}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            category.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {category.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {formatDate(category.updated_at)}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {category.created_by_name || 'Unknown'}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openModal('edit', category)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              <Edit3 className="w-4 h-4 text-gray-400 hover:text-blue-600" />
                            </button>
                            <button
                              onClick={() => openModal('delete', category)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
                            </button>
                          </div>
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
        {filteredCategories.length === 0 && !loading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery ? 'Try adjusting your search terms.' : 'Create your first category to organize your files.'}
            </p>
            <button
              onClick={() => openModal('add')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {modalMode === 'add' && 'Add New Category'}
                  {modalMode === 'edit' && 'Edit Category'}
                  {modalMode === 'delete' && 'Delete Category'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <span className="text-red-700 text-sm">{error}</span>
                </div>
              )}

              {modalMode === 'delete' ? (
                <div>
                  <p className="text-gray-600 mb-6">
                    Are you sure you want to delete "{selectedCategory?.name}"? This action cannot be undone.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={closeModal}
                      disabled={submitting}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={submitting}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {submitting && <Loader className="w-4 h-4 animate-spin" />}
                      Delete Category
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Enter category name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Enter category description"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Color
                        </label>
                        <input
                          type="color"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Icon
                        </label>
                        <select
                          value={formData.icon}
                          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                          {Object.keys(iconOptions).map(iconName => (
                            <option key={iconName} value={iconName}>
                              {iconName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                        Active category
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end mt-6">
                    <button
                      onClick={closeModal}
                      disabled={submitting}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {submitting && <Loader className="w-4 h-4 animate-spin" />}
                      {modalMode === 'add' ? 'Create Category' : 'Update Category'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Categories;