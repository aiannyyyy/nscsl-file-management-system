const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const fs = require('fs');
const util = require('util');
const validator = require('validator');
const archiver = require('archiver');
const unlinkAsync = util.promisify(fs.unlink);
//instead of requuire ('mtsql2')
const mysql = require('mysql2/promise');
const { route } = require('./files');

const router = express.Router();

// == Security Condiguration ==================
const ALLOWED_FILE_TYPES = [
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', // Images
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', // Documents
  'txt', 'csv', 'json', 'xml', 'html', 'css', 'js', // Text files
  'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', // Video
  'mp3', 'wav', 'flac', 'aac', 'ogg', // Audio
  'zip', 'rar', '7z', 'tar', 'gz' // Archives
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES_PER_REQUEST = 10; // 10 files

// ========= Helper Validate User =============
async function validateUser(userId) {
    console.log("Validating user ID:", userId, "Type", typeof userId);

    try {
        const [rows] = await db.promise().query("select id, name, email from users where id = ?", [userId])
        console.log("User validation query result:", rows);

        if (rows.length > 0) {
            console.log("User found:", rows[0]);
            return true;
        } else {
            console.log("No user found with ID:", userId);
            return false;
        }
    } catch (error) {
        console.error("Error validating user:", error);
        return false;
    }
}

// ========== Helper: Get User Details ============
async function getUserDetails(userId) {
    try{
        const [rows] = await db.promise().query("select id, name, user_name, email from users where id = ?", [userId]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("Error getting user details:", error);
        return null;
    }
}

// ========== Helper: Get Validate File Path ============
function validateFilePath(filePath) {
    const normalizedPath = path.normalize(filePath);
    // Just check for path traversal attacks, allow any path containing 'uploads'
    return !normalizedPath.includes('..') && normalizedPath.includes('uploads');
}

// ================== Fix the validateFileType function ==================
function validateFileType(fileName) {
    const ext = path.extname(fileName).substring(1).toLowerCase(); // Fixed: fileName instead of filename
    return ALLOWED_FILE_TYPES.includes(ext);
}

// ========== Helper: Sanitize Input ============
function sanitizeInput(input) {
    if (!input) return input;
    return validator.escape(input.toString().trim());
}

// ========== Helper: Format File Size ============
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ================== Fixed activity log SQL ==================
async function addActivityLog(userId, action, targetType, targetId, targetName, additionalInfo = null) {
    try {
        const actionMap = {
            'create': 'CREATE',
            'upload': 'CREATE',
            'update': 'UPDATE',
            'rename': 'UPDATE',
            'move': 'UPDATE',
            'move_rename': 'UPDATE',
            'delete': 'DELETE',
            'download': 'UPDATE', // Since DOWNLOAD is not in your ENUM
            'copy': 'CREATE',
            'star': 'UPDATE',
            'unstar': 'UPDATE'
        };

        const entityTypeMap = {
            'file': 'FILE',
            'folder': 'FOLDER'
        };

        const mappedAction = actionMap[action] || 'CREATE';
        const mappedEntityType = entityTypeMap[targetType] || 'FILE';

        // Create description from targetName and additionalInfo
        let description = targetName;
        if (additionalInfo) {
            description += ` - ${additionalInfo}`;
        }

        // Fixed: Match your actual database schema with target_type as varchar
        await db.promise().query(
            `INSERT INTO activity_logs (user_id, action, target_type, target_id, target_name, additional_info, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [userId, mappedAction, mappedEntityType, targetId, targetName, additionalInfo]
        );

        console.log(`📝 Log: ${mappedAction} ${mappedEntityType} (${targetName}) by user ${userId}`);
    } catch (error) {
        console.error("Error adding activity log:", error);
    }
}

// ================== Helper: Execute with Transaction ==================
async function executeWithTransaction(operations) {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    
    const results = [];
    for (const operation of operations) {
      const result = await operation(connection);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ================== Configure Storage ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("📁 Setting upload destination: uploads/");
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = Date.now() + "-" + sanitizedName;
    console.log("📝 Generated filename:", filename);
    cb(null, filename);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_REQUEST,
  },
  fileFilter: (req, file, cb) => {
    console.log("🔍 File filter check:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    if (!validateFileType(file.originalname)) {
      console.log("❌ File type not allowed:", file.originalname);
      return cb(new Error(`File type not allowed. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`), false);
    }
    
    cb(null, true);
  }
});

// ================== Get All Categories (Missing) ==================
router.get('/categories', async (req, res) => {
  try {
    const { is_active, created_by } = req.query;
    
    let query = `
      SELECT c.*, u.name as created_by_name, uu.name as updated_by_name
      FROM categories c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN users uu ON c.updated_by = uu.id
      WHERE 1=1
    `;
    const params = [];

    if (is_active !== undefined) {
      query += " AND c.is_active = ?";
      params.push(is_active === 'true' ? 1 : 0);
    }

    if (created_by) {
      query += " AND c.created_by = ?";
      params.push(created_by);
    }

    query += " ORDER BY c.created_at DESC";

    const [categories] = await db.promise().query(query, params);

    res.json({
      message: "Categories retrieved successfully",
      categories: categories
    });

  } catch (error) {
    console.error("❌ Error getting categories:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Create Category ==================
router.post('/categories', async (req, res) => {
  try {
    const { name, description, color, icon, is_active, created_by } = req.body;

    // ✅ Validate required fields
    if (!name || !created_by) {
      return res.status(400).json({ error: "Name and created_by are required" });
    }

    // ✅ Sanitize input
    const sanitizedName = sanitizeInput(name);
    const sanitizedDesc = sanitizeInput(description || "");
    const sanitizedColor = sanitizeInput(color || "#007bff");
    const sanitizedIcon = sanitizeInput(icon || "folder");
    const sanitizedActive = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    // ✅ Validate user exists
    const userValid = await validateUser(created_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid created_by user" });
    }

    // ✅ Insert into DB
    const [result] = await db.promise().query(
      `INSERT INTO categories 
      (name, description, color, icon, is_active, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [sanitizedName, sanitizedDesc, sanitizedColor, sanitizedIcon, sanitizedActive, created_by]
    );

    // ✅ Log activity
    await addActivityLog(created_by, 'create', 'folder', result.insertId, sanitizedName);

    res.status(201).json({
      message: "Category created successfully",
      category_id: result.insertId
    });

  } catch (error) {
    console.error("❌ Error creating category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Get Single Category (Missing) ==================
router.get('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid category ID is required" });
    }

    const [categories] = await db.promise().query(
      `SELECT c.*, u.name as created_by_name, uu.name as updated_by_name
       FROM categories c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN users uu ON c.updated_by = uu.id
       WHERE c.id = ?`,
      [id]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({
      message: "Category retrieved successfully",
      category: categories[0]
    });

  } catch (error) {
    console.error("❌ Error getting category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Update Category (Missing) ==================
router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon, is_active, updated_by } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid category ID is required" });
    }

    if (!updated_by) {
      return res.status(400).json({ error: "updated_by is required" });
    }

    // ✅ Check if category exists
    const [existingCategories] = await db.promise().query("SELECT * FROM categories WHERE id = ?", [id]);
    if (existingCategories.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const currentCategory = existingCategories[0];

    // ✅ Validate user exists
    const userValid = await validateUser(updated_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid updated_by user" });
    }

    // ✅ Prepare update fields
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(sanitizeInput(name));
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(sanitizeInput(description));
    }
    if (color !== undefined) {
      updates.push("color = ?");
      params.push(sanitizeInput(color));
    }
    if (icon !== undefined) {
      updates.push("icon = ?");
      params.push(sanitizeInput(icon));
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(is_active ? 1 : 0);
    }

    updates.push("updated_by = ?, updated_at = NOW()");
    params.push(updated_by, id);

    // ✅ Update category
    await db.promise().query(
      `UPDATE categories SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    // ✅ Log activity
    const actionType = (name && name !== currentCategory.name) ? 'rename' : 'update';
    await addActivityLog(updated_by, actionType, 'folder', id, name || currentCategory.name);

    res.json({
      message: "Category updated successfully"
    });

  } catch (error) {
    console.error("❌ Error updating category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Delete Category (Missing) ==================
router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleted_by } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid category ID is required" });
    }

    if (!deleted_by) {
      return res.status(400).json({ error: "deleted_by is required" });
    }

    // ✅ Validate user exists
    const userValid = await validateUser(deleted_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid deleted_by user" });
    }

    // ✅ Check if category exists
    const [existingCategories] = await db.promise().query("SELECT * FROM categories WHERE id = ?", [id]);
    if (existingCategories.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const category = existingCategories[0];

    // ✅ Check for folders in this category
    const [folders] = await db.promise().query("SELECT COUNT(*) as count FROM categories_folders WHERE category_id = ?", [id]);
    if (folders[0].count > 0) {
      return res.status(400).json({ error: "Cannot delete category with folders" });
    }

    // ✅ Check for files in this category
    const [files] = await db.promise().query("SELECT COUNT(*) as count FROM categories_files WHERE category_id = ?", [id]);
    if (files[0].count > 0) {
      return res.status(400).json({ error: "Cannot delete category with files" });
    }

    // ✅ Delete category
    await db.promise().query("DELETE FROM categories WHERE id = ?", [id]);

    // ✅ Log activity
    await addActivityLog(deleted_by, 'delete', 'folder', id, category.name);

    res.json({
      message: "Category deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Create Folder ==================
router.post('/folders', async (req, res) => {
  try {
    const { name, description, category_id, parent_folder_id, path, created_by } = req.body;

    // ✅ Validate required fields
    if (!name || !category_id || !created_by) {
      return res.status(400).json({ error: "Name, category_id, and created_by are required" });
    }

    // ✅ Sanitize input
    const sanitizedName = sanitizeInput(name);
    const sanitizedDesc = sanitizeInput(description || "");
    const sanitizedPath = sanitizeInput(path || sanitizedName);

    // ✅ Validate user exists
    const userValid = await validateUser(created_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid created_by user" });
    }

    // ✅ Validate category exists
    const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [category_id]);
    if (categoryRows.length === 0) {
      return res.status(400).json({ error: "Invalid category_id" });
    }

    // ✅ Validate parent folder if provided
    if (parent_folder_id) {
      const [parentRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ?", [parent_folder_id]);
      if (parentRows.length === 0) {
        return res.status(400).json({ error: "Invalid parent_folder_id" });
      }
    }

    // ✅ Insert into DB
    const [result] = await db.promise().query(
      `INSERT INTO categories_folders 
      (name, description, category_id, parent_folder_id, path, is_active, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
      [sanitizedName, sanitizedDesc, category_id, parent_folder_id || null, sanitizedPath, created_by]
    );

    // ✅ Log activity
    await addActivityLog(created_by, 'create', 'folder', result.insertId, sanitizedName);

    res.status(201).json({
      message: "Folder created successfully",
      folder_id: result.insertId
    });

  } catch (error) {
    console.error("❌ Error creating folder:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Get All Folders ==================
router.get('/folders', async (req, res) => {
  try {
    const { category_id, parent_folder_id, is_active } = req.query;
    
    let query = `
      SELECT f.*, c.name as category_name, u.name as created_by_name
      FROM categories_folders f
      LEFT JOIN categories c ON f.category_id = c.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    // ✅ Filter by category
    if (category_id) {
      query += " AND f.category_id = ?";
      params.push(category_id);
    }

    // ✅ Filter by parent folder
    if (parent_folder_id !== undefined) {
      if (parent_folder_id === 'null' || parent_folder_id === '') {
        query += " AND f.parent_folder_id IS NULL";
      } else {
        query += " AND f.parent_folder_id = ?";
        params.push(parent_folder_id);
      }
    }

    // ✅ Filter by active status
    if (is_active !== undefined) {
      query += " AND f.is_active = ?";
      params.push(is_active === 'true' ? 1 : 0);
    }

    query += " ORDER BY f.created_at DESC";

    const [folders] = await db.promise().query(query, params);

    res.json({
      message: "Folders retrieved successfully",
      folders: folders
    });

  } catch (error) {
    console.error("❌ Error getting folders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Get Single Folder ==================
router.get('/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid folder ID is required" });
    }

    const [folders] = await db.promise().query(
      `SELECT f.*, c.name as category_name, u.name as created_by_name,
              uu.name as updated_by_name
       FROM categories_folders f
       LEFT JOIN categories c ON f.category_id = c.id
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users uu ON f.updated_by = uu.id
       WHERE f.id = ?`,
      [id]
    );

    if (folders.length === 0) {
      return res.status(404).json({ error: "Folder not found" });
    }

    res.json({
      message: "Folder retrieved successfully",
      folder: folders[0]
    });

  } catch (error) {
    console.error("❌ Error getting folder:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Update Folder ==================
router.put('/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category_id, parent_folder_id, path, is_active, updated_by } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid folder ID is required" });
    }

    if (!updated_by) {
      return res.status(400).json({ error: "updated_by is required" });
    }

    // ✅ Check if folder exists
    const [existingFolders] = await db.promise().query("SELECT * FROM categories_folders WHERE id = ?", [id]);
    if (existingFolders.length === 0) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const currentFolder = existingFolders[0];

    // ✅ Validate user exists
    const userValid = await validateUser(updated_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid updated_by user" });
    }

    // ✅ Validate category exists if provided
    if (category_id && category_id !== currentFolder.category_id) {
      const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [category_id]);
      if (categoryRows.length === 0) {
        return res.status(400).json({ error: "Invalid category_id" });
      }
    }

    // ✅ Validate parent folder if provided
    if (parent_folder_id && parent_folder_id !== currentFolder.parent_folder_id) {
      const [parentRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ?", [parent_folder_id]);
      if (parentRows.length === 0) {
        return res.status(400).json({ error: "Invalid parent_folder_id" });
      }
      
      // Prevent circular reference
      if (parent_folder_id == id) {
        return res.status(400).json({ error: "Folder cannot be its own parent" });
      }
    }

    // ✅ Prepare update fields
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(sanitizeInput(name));
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(sanitizeInput(description));
    }
    if (category_id !== undefined) {
      updates.push("category_id = ?");
      params.push(category_id);
    }
    if (parent_folder_id !== undefined) {
      updates.push("parent_folder_id = ?");
      params.push(parent_folder_id || null);
    }
    if (path !== undefined) {
      updates.push("path = ?");
      params.push(sanitizeInput(path));
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(is_active ? 1 : 0);
    }

    updates.push("updated_by = ?, updated_at = NOW()");
    params.push(updated_by, id);

    // ✅ Update folder
    await db.promise().query(
      `UPDATE categories_folders SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    // ✅ Log activity
    const actionType = (name && name !== currentFolder.name) ? 'rename' : 'update';
    await addActivityLog(updated_by, actionType, 'folder', id, name || currentFolder.name);

    res.json({
      message: "Folder updated successfully"
    });

  } catch (error) {
    console.error("❌ Error updating folder:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Delete Folder ==================
router.delete('/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleted_by } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid folder ID is required" });
    }

    if (!deleted_by) {
      return res.status(400).json({ error: "deleted_by is required" });
    }

    // ✅ Validate user exists
    const userValid = await validateUser(deleted_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid deleted_by user" });
    }

    // ✅ Check if folder exists
    const [existingFolders] = await db.promise().query("SELECT * FROM categories_folders WHERE id = ?", [id]);
    if (existingFolders.length === 0) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const folder = existingFolders[0];

    // ✅ Check for child folders
    const [childFolders] = await db.promise().query("SELECT COUNT(*) as count FROM categories_folders WHERE parent_folder_id = ?", [id]);
    if (childFolders[0].count > 0) {
      return res.status(400).json({ error: "Cannot delete folder with child folders" });
    }

    // ✅ Check for files in this folder
    const [files] = await db.promise().query("SELECT COUNT(*) as count FROM categories_files WHERE folder_id = ?", [id]);
    if (files[0].count > 0) {
      return res.status(400).json({ error: "Cannot delete folder containing files" });
    }

    // ✅ Delete folder
    await db.promise().query("DELETE FROM categories_folders WHERE id = ?", [id]);

    // ✅ Log activity
    await addActivityLog(deleted_by, 'delete', 'folder', id, folder.name);

    res.json({
      message: "Folder deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting folder:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Get Folder Tree ==================
router.get('/folders/tree/:category_id', async (req, res) => {
  try {
    const { category_id } = req.params;

    if (!category_id || isNaN(category_id)) {
      return res.status(400).json({ error: "Valid category ID is required" });
    }

    // Get all folders for the category
    const [folders] = await db.promise().query(
      "SELECT id, name, parent_folder_id, path FROM categories_folders WHERE category_id = ? AND is_active = 1 ORDER BY name",
      [category_id]
    );

    // Build tree structure
    const buildTree = (parentId = null) => {
      return folders
        .filter(folder => folder.parent_folder_id === parentId)
        .map(folder => ({
          ...folder,
          children: buildTree(folder.id)
        }));
    };

    const tree = buildTree();

    res.json({
      message: "Folder tree retrieved successfully",
      tree: tree
    });

  } catch (error) {
    console.error("❌ Error getting folder tree:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Upload Files ==================
router.post('/files/upload', upload.array('files', MAX_FILES_PER_REQUEST), async (req, res) => {
  try {
    const { category_id, folder_id, created_by } = req.body;
    const uploadedFiles = req.files;

    // ✅ Validate required fields
    if (!category_id || !created_by) {
      return res.status(400).json({ error: "category_id and created_by are required" });
    }

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // ✅ Validate user exists
    const userValid = await validateUser(created_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid created_by user" });
    }

    // ✅ Validate category exists
    const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [category_id]);
    if (categoryRows.length === 0) {
      return res.status(400).json({ error: "Invalid category_id" });
    }

    // ✅ Validate folder if provided
    if (folder_id) {
      const [folderRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ? AND category_id = ?", [folder_id, category_id]);
      if (folderRows.length === 0) {
        return res.status(400).json({ error: "Invalid folder_id for this category" });
      }
    }

    const uploadResults = [];
    const errors = [];

    // ✅ Process each uploaded file
    for (const file of uploadedFiles) {
      try {
        const sanitizedOriginalName = sanitizeInput(file.originalname);
        
        // Insert file record into database
        const [result] = await db.promise().query(
          `INSERT INTO categories_files 
          (name, original_name, file_type, file_size, mime_type, file_path, category_id, folder_id, 
           is_starred, is_active, download_count, last_accessed, created_by, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, NOW(), ?, NOW(), NOW())`,
          [
            sanitizedOriginalName,
            sanitizedOriginalName,
            path.extname(file.originalname).substring(1).toLowerCase(),
            file.size,
            file.mimetype,
            file.path,
            category_id,
            folder_id || null,
            created_by
          ]
        );

        // ✅ Log activity
        await addActivityLog(created_by, 'upload', 'file', result.insertId, sanitizedOriginalName, 
          `Size: ${formatFileSize(file.size)}, Type: ${file.mimetype}`);

        uploadResults.push({
          file_id: result.insertId,
          original_name: sanitizedOriginalName,
          file_size: formatFileSize(file.size),
          file_type: path.extname(file.originalname).substring(1).toLowerCase()
        });

      } catch (fileError) {
        console.error(`❌ Error processing file ${file.originalname}:`, fileError);
        errors.push({
          filename: file.originalname,
          error: "Failed to process file"
        });
        
        // Clean up failed upload
        try {
          await unlinkAsync(file.path);
        } catch (unlinkError) {
          console.error("Failed to cleanup file:", unlinkError);
        }
      }
    }

    res.status(201).json({
      message: `${uploadResults.length} file(s) uploaded successfully`,
      uploaded_files: uploadResults,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("❌ Error uploading files:", error);
    
    // Clean up uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        try {
          await unlinkAsync(file.path);
        } catch (unlinkError) {
          console.error("Failed to cleanup file:", unlinkError);
        }
      }
    }
    
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Get All Files ==================
router.get('/files', async (req, res) => {
  try {
    const { category_id, folder_id, file_type, is_starred, is_active, search, limit, offset } = req.query;
    
    let query = `
      SELECT f.*, c.name as category_name, cf.name as folder_name, 
             u.name as created_by_name, uu.name as updated_by_name
      FROM categories_files f
      LEFT JOIN categories c ON f.category_id = c.id
      LEFT JOIN categories_folders cf ON f.folder_id = cf.id
      LEFT JOIN users u ON f.created_by = u.id
      LEFT JOIN users uu ON f.updated_by = uu.id
      WHERE 1=1
    `;
    const params = [];

    // ✅ Filter by category
    if (category_id) {
      query += " AND f.category_id = ?";
      params.push(category_id);
    }

    // ✅ Filter by folder
    if (folder_id !== undefined) {
      if (folder_id === 'null' || folder_id === '') {
        query += " AND f.folder_id IS NULL";
      } else {
        query += " AND f.folder_id = ?";
        params.push(folder_id);
      }
    }

    // ✅ Filter by file type
    if (file_type) {
      query += " AND f.file_type = ?";
      params.push(file_type);
    }

    // ✅ Filter by starred
    if (is_starred !== undefined) {
      query += " AND f.is_starred = ?";
      params.push(is_starred === 'true' ? 1 : 0);
    }

    // ✅ Filter by active status
    if (is_active !== undefined) {
      query += " AND f.is_active = ?";
      params.push(is_active === 'true' ? 1 : 0);
    }

    // ✅ Search by filename
    if (search) {
      query += " AND (f.name LIKE ? OR f.original_name LIKE ?)";
      const searchTerm = `%${sanitizeInput(search)}%`;
      params.push(searchTerm, searchTerm);
    }

    query += " ORDER BY f.created_at DESC";

    // ✅ Pagination
    if (limit) {
      query += " LIMIT ?";
      params.push(parseInt(limit));
      
      if (offset) {
        query += " OFFSET ?";
        params.push(parseInt(offset));
      }
    }

    const [files] = await db.promise().query(query, params);

    // ✅ Format file sizes
    const formattedFiles = files.map(file => ({
      ...file,
      formatted_size: formatFileSize(file.file_size)
    }));

    res.json({
      message: "Files retrieved successfully",
      files: formattedFiles,
      total_count: files.length
    });

  } catch (error) {
    console.error("❌ Error getting files:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Get Single File ==================
router.get('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid file ID is required" });
    }

    const [files] = await db.promise().query(
      `SELECT f.*, c.name as category_name, cf.name as folder_name,
              u.name as created_by_name, uu.name as updated_by_name
       FROM categories_files f
       LEFT JOIN categories c ON f.category_id = c.id
       LEFT JOIN categories_folders cf ON f.folder_id = cf.id
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users uu ON f.updated_by = uu.id
       WHERE f.id = ?`,
      [id]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = files[0];
    file.formatted_size = formatFileSize(file.file_size);

    res.json({
      message: "File retrieved successfully",
      file: file
    });

  } catch (error) {
    console.error("❌ Error getting file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Update File ==================
router.put('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, folder_id, is_starred, is_active, updated_by } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid file ID is required" });
    }

    if (!updated_by) {
      return res.status(400).json({ error: "updated_by is required" });
    }

    // ✅ Check if file exists
    const [existingFiles] = await db.promise().query("SELECT * FROM categories_files WHERE id = ?", [id]);
    if (existingFiles.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const currentFile = existingFiles[0];

    // ✅ Validate user exists
    const userValid = await validateUser(updated_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid updated_by user" });
    }

    // ✅ Validate category if provided
    if (category_id && category_id !== currentFile.category_id) {
      const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [category_id]);
      if (categoryRows.length === 0) {
        return res.status(400).json({ error: "Invalid category_id" });
      }
    }

    // ✅ Validate folder if provided
    if (folder_id && folder_id !== currentFile.folder_id) {
      const finalCategoryId = category_id || currentFile.category_id;
      const [folderRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ? AND category_id = ?", [folder_id, finalCategoryId]);
      if (folderRows.length === 0) {
        return res.status(400).json({ error: "Invalid folder_id for this category" });
      }
    }

    // ✅ Prepare update fields
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(sanitizeInput(name));
    }
    if (category_id !== undefined) {
      updates.push("category_id = ?");
      params.push(category_id);
    }
    if (folder_id !== undefined) {
      updates.push("folder_id = ?");
      params.push(folder_id || null);
    }
    if (is_starred !== undefined) {
      updates.push("is_starred = ?");
      params.push(is_starred ? 1 : 0);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(is_active ? 1 : 0);
    }

    updates.push("updated_by = ?, updated_at = NOW()");
    params.push(updated_by, id);

    // ✅ Update file
    await db.promise().query(
      `UPDATE categories_files SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    // ✅ Log activity
    const actionType = (name && name !== currentFile.name) ? 'rename' : 'update';
    const actionInfo = folder_id !== currentFile.folder_id ? 'Moved to different folder' : null;
    await addActivityLog(updated_by, actionType, 'file', id, name || currentFile.name, actionInfo);

    res.json({
      message: "File updated successfully"
    });

  } catch (error) {
    console.error("❌ Error updating file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Delete File ==================
router.delete('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleted_by } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid file ID is required" });
    }

    if (!deleted_by) {
      return res.status(400).json({ error: "deleted_by is required" });
    }

    // ✅ Validate user exists
    const userValid = await validateUser(deleted_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid deleted_by user" });
    }

    // ✅ Check if file exists
    const [existingFiles] = await db.promise().query("SELECT * FROM categories_files WHERE id = ?", [id]);
    if (existingFiles.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = existingFiles[0];

    // ✅ Delete physical file
    try {
      if (validateFilePath(file.file_path)) {
        await unlinkAsync(file.file_path);
      }
    } catch (fileError) {
      console.error("❌ Error deleting physical file:", fileError);
      // Continue with database deletion even if physical file deletion fails
    }

    // ✅ Delete from database
    await db.promise().query("DELETE FROM categories_files WHERE id = ?", [id]);

    // ✅ Log activity
    await addActivityLog(deleted_by, 'delete', 'file', id, file.name, `Size: ${formatFileSize(file.file_size)}`);

    res.json({
      message: "File deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Bulk Upload with Progress Tracking ==================
router.post('/files/bulk-upload', upload.array('files', MAX_FILES_PER_REQUEST), async (req, res) => {
  try {
    const { category_id, folder_id, created_by, overwrite } = req.body;
    const uploadedFiles = req.files;

    if (!category_id || !created_by) {
      return res.status(400).json({ error: "category_id and created_by are required" });
    }

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // ✅ Validate user and category
    const userValid = await validateUser(created_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid created_by user" });
    }

    const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [category_id]);
    if (categoryRows.length === 0) {
      return res.status(400).json({ error: "Invalid category_id" });
    }

    const results = {
      uploaded: [],
      skipped: [],
      errors: [],
      total: uploadedFiles.length
    };

    // Process each file
    for (const file of uploadedFiles) {
      try {
        const sanitizedOriginalName = sanitizeInput(file.originalname);
        
        // Check for duplicates if overwrite is false
        if (!overwrite) {
          const [existing] = await db.promise().query(
            "SELECT id FROM categories_files WHERE original_name = ? AND category_id = ? AND folder_id = ?",
            [sanitizedOriginalName, category_id, folder_id || null]
          );
          
          if (existing.length > 0) {
            results.skipped.push({
              filename: sanitizedOriginalName,
              reason: "File already exists"
            });
            await unlinkAsync(file.path);
            continue;
          }
        }

        const [result] = await db.promise().query(
          `INSERT INTO categories_files 
          (name, original_name, file_type, file_size, mime_type, file_path, category_id, folder_id, 
           is_starred, is_active, download_count, last_accessed, created_by, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, NOW(), ?, NOW(), NOW())`,
          [
            sanitizedOriginalName,
            sanitizedOriginalName,
            path.extname(file.originalname).substring(1).toLowerCase(),
            file.size,
            file.mimetype,
            file.path,
            category_id,
            folder_id || null,
            created_by
          ]
        );

        await addActivityLog(created_by, 'upload', 'file', result.insertId, sanitizedOriginalName);

        results.uploaded.push({
          file_id: result.insertId,
          original_name: sanitizedOriginalName,
          file_size: formatFileSize(file.size)
        });

      } catch (fileError) {
        console.error(`❌ Error processing file ${file.originalname}:`, fileError);
        results.errors.push({
          filename: file.originalname,
          error: "Failed to process file"
        });
        
        try {
          await unlinkAsync(file.path);
        } catch (unlinkError) {
          console.error("Failed to cleanup file:", unlinkError);
        }
      }
    }

    res.json({
      message: `Bulk upload completed: ${results.uploaded.length} uploaded, ${results.skipped.length} skipped, ${results.errors.length} errors`,
      results: results
    });

  } catch (error) {
    console.error("❌ Error in bulk upload:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Move Multiple Files ==================
router.post('/files/move-multiple', async (req, res) => {
  try {
    const { file_ids, target_category_id, target_folder_id, moved_by } = req.body;

    if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
      return res.status(400).json({ error: "file_ids array is required" });
    }

    if (!target_category_id || !moved_by) {
      return res.status(400).json({ error: "target_category_id and moved_by are required" });
    }

    // ✅ Validate user
    const userValid = await validateUser(moved_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid moved_by user" });
    }

    // ✅ Validate target category
    const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [target_category_id]);
    if (categoryRows.length === 0) {
      return res.status(400).json({ error: "Invalid target_category_id" });
    }

    // ✅ Validate target folder if provided
    if (target_folder_id) {
      const [folderRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ? AND category_id = ?", [target_folder_id, target_category_id]);
      if (folderRows.length === 0) {
        return res.status(400).json({ error: "Invalid target_folder_id for this category" });
      }
    }

    const results = { moved: [], errors: [] };

    // Process each file
    for (const file_id of file_ids) {
      try {
        const [files] = await db.promise().query("SELECT * FROM categories_files WHERE id = ?", [file_id]);
        if (files.length === 0) {
          results.errors.push({ file_id, error: "File not found" });
          continue;
        }

        await db.promise().query(
          "UPDATE categories_files SET category_id = ?, folder_id = ?, updated_by = ?, updated_at = NOW() WHERE id = ?",
          [target_category_id, target_folder_id || null, moved_by, file_id]
        );

        await addActivityLog(moved_by, 'move', 'file', file_id, files[0].name);
        results.moved.push({ file_id, name: files[0].name });

      } catch (error) {
        console.error(`❌ Error moving file ${file_id}:`, error);
        results.errors.push({ file_id, error: "Failed to move file" });
      }
    }

    res.json({
      message: `Move completed: ${results.moved.length} moved, ${results.errors.length} errors`,
      results: results
    });

  } catch (error) {
    console.error("❌ Error moving multiple files:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Copy Multiple Files ==================
router.post('/files/copy-multiple', async (req, res) => {
  try {
    const { file_ids, target_category_id, target_folder_id, copied_by } = req.body;

    if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
      return res.status(400).json({ error: "file_ids array is required" });
    }

    if (!target_category_id || !copied_by) {
      return res.status(400).json({ error: "target_category_id and copied_by are required" });
    }

    const userValid = await validateUser(copied_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid copied_by user" });
    }

    const results = { copied: [], errors: [] };

    for (const file_id of file_ids) {
      try {
        const [files] = await db.promise().query("SELECT * FROM categories_files WHERE id = ?", [file_id]);
        if (files.length === 0) {
          results.errors.push({ file_id, error: "File not found" });
          continue;
        }

        const originalFile = files[0];
        const newFileName = `Copy of ${originalFile.name}`;

        // Copy physical file
        const originalPath = originalFile.file_path;
        const newPath = originalPath.replace(path.basename(originalPath), `${Date.now()}-${path.basename(originalPath)}`);
        
        await fs.promises.copyFile(originalPath, newPath);

        // Insert new record
        const [result] = await db.promise().query(
          `INSERT INTO categories_files 
          (name, original_name, file_type, file_size, mime_type, file_path, category_id, folder_id, 
           is_starred, is_active, download_count, last_accessed, created_by, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, NOW(), ?, NOW(), NOW())`,
          [
            newFileName,
            newFileName,
            originalFile.file_type,
            originalFile.file_size,
            originalFile.mime_type,
            newPath,
            target_category_id,
            target_folder_id || null,
            copied_by
          ]
        );

        await addActivityLog(copied_by, 'copy', 'file', result.insertId, newFileName);
        results.copied.push({ file_id: result.insertId, name: newFileName });

      } catch (error) {
        console.error(`❌ Error copying file ${file_id}:`, error);
        results.errors.push({ file_id, error: "Failed to copy file" });
      }
    }

    res.json({
      message: `Copy completed: ${results.copied.length} copied, ${results.errors.length} errors`,
      results: results
    });

  } catch (error) {
    console.error("❌ Error copying multiple files:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Download File ==================
router.get('/files/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid file ID is required" });
    }

    // ✅ Get file info
    const [files] = await db.promise().query("SELECT * FROM categories_files WHERE id = ? AND is_active = 1", [id]);
    if (files.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = files[0];

    // ✅ Validate file path
    if (!validateFilePath(file.file_path)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // ✅ Check if physical file exists
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: "Physical file not found" });
    }

    // ✅ Update download count and last accessed
    await db.promise().query(
      "UPDATE categories_files SET download_count = download_count + 1, last_accessed = NOW() WHERE id = ?",
      [id]
    );

    // ✅ Log download activity if user_id provided
    if (user_id) {
      await addActivityLog(user_id, 'download', 'file', id, file.name, `Size: ${formatFileSize(file.file_size)}`);
    }

    // ✅ Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Length', file.file_size);

    // ✅ Stream file
    const fileStream = fs.createReadStream(file.file_path);
    fileStream.pipe(res);

  } catch (error) {
    console.error("❌ Error downloading file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Toggle Star File ==================
router.patch('/files/:id/star', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, is_starred } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid file ID is required" });
    }

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // ✅ Validate user exists
    const userValid = await validateUser(user_id);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid user_id" });
    }

    // ✅ Check if file exists
    const [existingFiles] = await db.promise().query("SELECT * FROM categories_files WHERE id = ?", [id]);
    if (existingFiles.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = existingFiles[0];
    const newStarredStatus = is_starred !== undefined ? (is_starred ? 1 : 0) : (file.is_starred ? 0 : 1);

    // ✅ Update starred status
    await db.promise().query(
      "UPDATE categories_files SET is_starred = ?, updated_by = ?, updated_at = NOW() WHERE id = ?",
      [newStarredStatus, user_id, id]
    );

    // ✅ Log activity
    const action = newStarredStatus ? 'starred' : 'unstarred';
    await addActivityLog(user_id, 'update', 'file', id, file.name, `File ${action}`);

    res.json({
      message: `File ${newStarredStatus ? 'starred' : 'unstarred'} successfully`,
      is_starred: newStarredStatus === 1
    });

  } catch (error) {
    console.error("❌ Error toggling file star:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Get File Statistics ==================
router.get('/files/stats/:category_id', async (req, res) => {
  try {
    const { category_id } = req.params;

    if (!category_id || isNaN(category_id)) {
      return res.status(400).json({ error: "Valid category ID is required" });
    }

    const [stats] = await db.promise().query(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        COUNT(CASE WHEN is_starred = 1 THEN 1 END) as starred_files,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_files,
        SUM(download_count) as total_downloads,
        file_type,
        COUNT(*) as type_count
      FROM categories_files 
      WHERE category_id = ?
      GROUP BY category_id, file_type
      WITH ROLLUP
    `, [category_id]);

    res.json({
      message: "File statistics retrieved successfully",
      stats: {
        total_files: stats[stats.length - 1]?.total_files || 0,
        total_size: formatFileSize(stats[stats.length - 1]?.total_size || 0),
        starred_files: stats[stats.length - 1]?.starred_files || 0,
        active_files: stats[stats.length - 1]?.active_files || 0,
        total_downloads: stats[stats.length - 1]?.total_downloads || 0,
        file_types: stats.slice(0, -1).filter(s => s.file_type).map(s => ({
          type: s.file_type,
          count: s.type_count,
          size: formatFileSize(s.total_size)
        }))
      }
    });

  } catch (error) {
    console.error("❌ Error getting file statistics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;