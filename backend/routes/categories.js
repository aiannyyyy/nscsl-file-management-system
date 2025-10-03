const express = require('express');
const path = require('path');
const db = require('../db');
const fs = require('fs');
const util = require('util');
const validator = require('validator');
const unlinkAsync = util.promisify(fs.unlink);
const mysql = require('mysql2/promise');

// Import centralized multer config
const { 
  uploadMultiple, 
  uploadSingle,  // Added this import
  handleMulterError, 
  formatFileSize, 
  validateFileType, 
  validateFilePath, 
  cleanupFiles,
  MAX_FILES_PER_REQUEST 
} = require('../config/multerConfig.js');

const router = express.Router();

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

// ========== Helper: Sanitize Input ============
function sanitizeInput(input) {
    if (!input) return input;
    return validator.escape(input.toString().trim());
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
            'download': 'UPDATE',
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

        let description = targetName;
        if (additionalInfo) {
            description += ` - ${additionalInfo}`;
        }

        await db.promise().query(
            `INSERT INTO activity_logs (user_id, action, target_type, target_id, target_name, additional_info, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [userId, mappedAction, mappedEntityType, targetId, targetName, additionalInfo]
        );

        console.log(`Log: ${mappedAction} ${mappedEntityType} (${targetName}) by user ${userId}`);
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

// ================== Get All Categories ==================
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
    console.error("Error getting categories:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Create Category ==================
router.post('/categories', async (req, res) => {
  try {
    const { name, description, color, icon, is_active, created_by } = req.body;

    if (!name || !created_by) {
      return res.status(400).json({ error: "Name and created_by are required" });
    }

    const sanitizedName = sanitizeInput(name);
    const sanitizedDesc = sanitizeInput(description || "");
    const sanitizedColor = sanitizeInput(color || "#007bff");
    const sanitizedIcon = sanitizeInput(icon || "folder");
    const sanitizedActive = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    const userValid = await validateUser(created_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid created_by user" });
    }

    const [result] = await db.promise().query(
      `INSERT INTO categories 
      (name, description, color, icon, is_active, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [sanitizedName, sanitizedDesc, sanitizedColor, sanitizedIcon, sanitizedActive, created_by]
    );

    await addActivityLog(created_by, 'create', 'folder', result.insertId, sanitizedName);

    res.status(201).json({
      message: "Category created successfully",
      category_id: result.insertId
    });

  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Get Single Category ==================
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
    console.error("Error getting category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Update Category ==================
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

    const [existingCategories] = await db.promise().query("SELECT * FROM categories WHERE id = ?", [id]);
    if (existingCategories.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const currentCategory = existingCategories[0];

    const userValid = await validateUser(updated_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid updated_by user" });
    }

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

    await db.promise().query(
      `UPDATE categories SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    const actionType = (name && name !== currentCategory.name) ? 'rename' : 'update';
    await addActivityLog(updated_by, actionType, 'folder', id, name || currentCategory.name);

    res.json({
      message: "Category updated successfully"
    });

  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Delete Category ==================
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

    const userValid = await validateUser(deleted_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid deleted_by user" });
    }

    const [existingCategories] = await db.promise().query("SELECT * FROM categories WHERE id = ?", [id]);
    if (existingCategories.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const category = existingCategories[0];

    const [folders] = await db.promise().query("SELECT COUNT(*) as count FROM categories_folders WHERE category_id = ?", [id]);
    if (folders[0].count > 0) {
      return res.status(400).json({ error: "Cannot delete category with folders" });
    }

    const [files] = await db.promise().query("SELECT COUNT(*) as count FROM categories_files WHERE category_id = ?", [id]);
    if (files[0].count > 0) {
      return res.status(400).json({ error: "Cannot delete category with files" });
    }

    await db.promise().query("DELETE FROM categories WHERE id = ?", [id]);

    await addActivityLog(deleted_by, 'delete', 'folder', id, category.name);

    res.json({
      message: "Category deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Create Folder ==================
router.post('/folders', async (req, res) => {
  try {
    const { name, description, category_id, parent_folder_id, path, created_by } = req.body;

    if (!name || !category_id || !created_by) {
      return res.status(400).json({ error: "Name, category_id, and created_by are required" });
    }

    const sanitizedName = sanitizeInput(name);
    const sanitizedDesc = sanitizeInput(description || "");
    const sanitizedPath = sanitizeInput(path || sanitizedName);

    const userValid = await validateUser(created_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid created_by user" });
    }

    const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [category_id]);
    if (categoryRows.length === 0) {
      return res.status(400).json({ error: "Invalid category_id" });
    }

    if (parent_folder_id) {
      const [parentRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ?", [parent_folder_id]);
      if (parentRows.length === 0) {
        return res.status(400).json({ error: "Invalid parent_folder_id" });
      }
    }

    const [result] = await db.promise().query(
      `INSERT INTO categories_folders 
      (name, description, category_id, parent_folder_id, path, is_active, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
      [sanitizedName, sanitizedDesc, category_id, parent_folder_id || null, sanitizedPath, created_by]
    );

    await addActivityLog(created_by, 'create', 'folder', result.insertId, sanitizedName);

    res.status(201).json({
      message: "Folder created successfully",
      folder_id: result.insertId
    });

  } catch (error) {
    console.error("Error creating folder:", error);
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

    if (category_id) {
      query += " AND f.category_id = ?";
      params.push(category_id);
    }

    if (parent_folder_id !== undefined) {
      if (parent_folder_id === 'null' || parent_folder_id === '') {
        query += " AND f.parent_folder_id IS NULL";
      } else {
        query += " AND f.parent_folder_id = ?";
        params.push(parent_folder_id);
      }
    }

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
    console.error("Error getting folders:", error);
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
    console.error("Error getting folder:", error);
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

    const [existingFolders] = await db.promise().query("SELECT * FROM categories_folders WHERE id = ?", [id]);
    if (existingFolders.length === 0) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const currentFolder = existingFolders[0];

    const userValid = await validateUser(updated_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid updated_by user" });
    }

    if (category_id && category_id !== currentFolder.category_id) {
      const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [category_id]);
      if (categoryRows.length === 0) {
        return res.status(400).json({ error: "Invalid category_id" });
      }
    }

    if (parent_folder_id && parent_folder_id !== currentFolder.parent_folder_id) {
      const [parentRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ?", [parent_folder_id]);
      if (parentRows.length === 0) {
        return res.status(400).json({ error: "Invalid parent_folder_id" });
      }
      
      if (parent_folder_id == id) {
        return res.status(400).json({ error: "Folder cannot be its own parent" });
      }
    }

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

    await db.promise().query(
      `UPDATE categories_folders SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    const actionType = (name && name !== currentFolder.name) ? 'rename' : 'update';
    await addActivityLog(updated_by, actionType, 'folder', id, name || currentFolder.name);

    res.json({
      message: "Folder updated successfully"
    });

  } catch (error) {
    console.error("Error updating folder:", error);
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

    const userValid = await validateUser(deleted_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid deleted_by user" });
    }

    const [existingFolders] = await db.promise().query("SELECT * FROM categories_folders WHERE id = ?", [id]);
    if (existingFolders.length === 0) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const folder = existingFolders[0];

    const [childFolders] = await db.promise().query("SELECT COUNT(*) as count FROM categories_folders WHERE parent_folder_id = ?", [id]);
    if (childFolders[0].count > 0) {
      return res.status(400).json({ error: "Cannot delete folder with child folders" });
    }

    const [files] = await db.promise().query("SELECT COUNT(*) as count FROM categories_files WHERE folder_id = ?", [id]);
    if (files[0].count > 0) {
      return res.status(400).json({ error: "Cannot delete folder containing files" });
    }

    await db.promise().query("DELETE FROM categories_folders WHERE id = ?", [id]);

    await addActivityLog(deleted_by, 'delete', 'folder', id, folder.name);

    res.json({
      message: "Folder deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting folder:", error);
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

    const [folders] = await db.promise().query(
      "SELECT id, name, parent_folder_id, path FROM categories_folders WHERE category_id = ? AND is_active = 1 ORDER BY name",
      [category_id]
    );

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
    console.error("Error getting folder tree:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Upload Single File ==================
router.post('/files/upload-single', uploadSingle('file'), async (req, res) => {
  console.log("=== SINGLE FILE UPLOAD DEBUG ===");
  console.log("Body:", req.body);
  console.log("File:", req.file);
  
  try {
    const { category_id, folder_id, created_by, description = '' } = req.body;
    const uploadedFile = req.file;

    if (!category_id || !created_by) {
      if (uploadedFile) {
        await cleanupFiles([uploadedFile]);
      }
      return res.status(400).json({ error: "category_id and created_by are required" });
    }

    if (!uploadedFile) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userValid = await validateUser(created_by);
    if (!userValid) {
      await cleanupFiles([uploadedFile]);
      return res.status(400).json({ error: "Invalid created_by user" });
    }

    const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [category_id]);
    if (categoryRows.length === 0) {
      await cleanupFiles([uploadedFile]);
      return res.status(400).json({ error: "Invalid category_id" });
    }

    if (folder_id) {
      const [folderRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ? AND category_id = ?", [folder_id, category_id]);
      if (folderRows.length === 0) {
        await cleanupFiles([uploadedFile]);
        return res.status(400).json({ error: "Invalid folder_id for this category" });
      }
    }

    try {
      const sanitizedOriginalName = sanitizeInput(uploadedFile.originalname);
      
      const [result] = await db.promise().query(
        `INSERT INTO categories_files 
        (name, original_name, description, file_type, file_size, mime_type, file_path, category_id, folder_id, 
         is_starred, is_active, download_count, last_accessed, created_by, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, NOW(), ?, NOW(), NOW())`,
        [
          sanitizedOriginalName,
          sanitizedOriginalName,
          description,
          path.extname(uploadedFile.originalname).substring(1).toLowerCase(),
          uploadedFile.size,
          uploadedFile.mimetype,
          uploadedFile.path,
          category_id,
          folder_id || null,
          created_by
        ]
      );

      await addActivityLog(created_by, 'upload', 'file', result.insertId, sanitizedOriginalName, 
        `Size: ${formatFileSize(uploadedFile.size)}, Type: ${uploadedFile.mimetype}`);

      res.status(201).json({
        message: "File uploaded successfully",
        file: {
          file_id: result.insertId,
          original_name: sanitizedOriginalName,
          file_size: formatFileSize(uploadedFile.size),
          file_type: path.extname(uploadedFile.originalname).substring(1).toLowerCase(),
          mime_type: uploadedFile.mimetype,
          description: description
        }
      });

    } catch (dbError) {
      console.error(`Error processing file ${uploadedFile.originalname}:`, dbError);
      await cleanupFiles([uploadedFile]);
      res.status(500).json({ error: "Failed to save file information" });
    }

  } catch (error) {
    console.error("Error uploading file:", error);
    if (req.file) {
      await cleanupFiles([req.file]);
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Upload Multiple Files ==================
router.post('/files/upload-multiple', uploadMultiple('files'), async (req, res) => {
  console.log("=== MULTIPLE FILES UPLOAD DEBUG ===");
  console.log("Body:", req.body);
  console.log("Files count:", req.files?.length || 0);
  
  try {
    const { category_id, folder_id, created_by } = req.body;
    const uploadedFiles = req.files;

    if (!category_id || !created_by) {
      if (uploadedFiles) {
        await cleanupFiles(uploadedFiles);
      }
      return res.status(400).json({ error: "category_id and created_by are required" });
    }

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const userValid = await validateUser(created_by);
    if (!userValid) {
      await cleanupFiles(uploadedFiles);
      return res.status(400).json({ error: "Invalid created_by user" });
    }

    const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [category_id]);
    if (categoryRows.length === 0) {
      await cleanupFiles(uploadedFiles);
      return res.status(400).json({ error: "Invalid category_id" });
    }

    if (folder_id) {
      const [folderRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ? AND category_id = ?", [folder_id, category_id]);
      if (folderRows.length === 0) {
        await cleanupFiles(uploadedFiles);
        return res.status(400).json({ error: "Invalid folder_id for this category" });
      }
    }

    const uploadResults = [];
    const errors = [];

    for (const file of uploadedFiles) {
      try {
        const sanitizedOriginalName = sanitizeInput(file.originalname);
        
        const [result] = await db.promise().query(
          `INSERT INTO categories_files 
          (name, original_name, description, file_type, file_size, mime_type, file_path, category_id, folder_id, 
           is_starred, is_active, download_count, last_accessed, created_by, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, NOW(), ?, NOW(), NOW())`,
          [
            sanitizedOriginalName,
            sanitizedOriginalName,
            '',
            path.extname(file.originalname).substring(1).toLowerCase(),
            file.size,
            file.mimetype,
            file.path,
            category_id,
            folder_id || null,
            created_by
          ]
        );

        await addActivityLog(created_by, 'upload', 'file', result.insertId, sanitizedOriginalName, 
          `Size: ${formatFileSize(file.size)}, Type: ${file.mimetype}`);

        uploadResults.push({
          file_id: result.insertId,
          original_name: sanitizedOriginalName,
          file_size: formatFileSize(file.size),
          file_type: path.extname(file.originalname).substring(1).toLowerCase(),
          mime_type: file.mimetype
        });

      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        errors.push({
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

    res.status(201).json({
      message: `${uploadResults.length} file(s) uploaded successfully`,
      files: uploadResults,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: uploadedFiles.length,
        successful: uploadResults.length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error("Error uploading files:", error);
    
    if (req.files) {
      await cleanupFiles(req.files);
    }
    
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Bulk Upload with Progress Tracking ==================
router.post('/files/bulk-upload', uploadMultiple('files'), async (req, res) => {
  console.log("=== BULK UPLOAD DEBUG ===");
  console.log("Body:", req.body);
  console.log("Files count:", req.files?.length || 0);
  
  try {
    const { category_id, folder_id, created_by, overwrite = false } = req.body;
    const uploadedFiles = req.files;

    if (!category_id || !created_by) {
      if (uploadedFiles) {
        await cleanupFiles(uploadedFiles);
      }
      return res.status(400).json({ error: "category_id and created_by are required" });
    }

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const userValid = await validateUser(created_by);
    if (!userValid) {
      await cleanupFiles(uploadedFiles);
      return res.status(400).json({ error: "Invalid created_by user" });
    }

    const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [category_id]);
    if (categoryRows.length === 0) {
      await cleanupFiles(uploadedFiles);
      return res.status(400).json({ error: "Invalid category_id" });
    }

    if (folder_id) {
      const [folderRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ? AND category_id = ?", [folder_id, category_id]);
      if (folderRows.length === 0) {
        await cleanupFiles(uploadedFiles);
        return res.status(400).json({ error: "Invalid folder_id for this category" });
      }
    }

    const results = {
      uploaded: [],
      skipped: [],
      errors: [],
      total: uploadedFiles.length
    };

    for (const file of uploadedFiles) {
      try {
        const sanitizedOriginalName = sanitizeInput(file.originalname);
        
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
        } else {
          const [existing] = await db.promise().query(
            "SELECT id FROM categories_files WHERE original_name = ? AND category_id = ? AND folder_id = ?",
            [sanitizedOriginalName, category_id, folder_id || null]
          );
          
          if (existing.length > 0) {
            await db.promise().query(
              `UPDATE categories_files 
               SET file_size = ?, mime_type = ?, file_path = ?, updated_at = NOW()
               WHERE id = ?`,
              [file.size, file.mimetype, file.path, existing[0].id]
            );
            
            await addActivityLog(created_by, 'update', 'file', existing[0].id, sanitizedOriginalName);
            
            results.uploaded.push({
              file_id: existing[0].id,
              original_name: sanitizedOriginalName,
              file_size: formatFileSize(file.size),
              action: 'updated'
            });
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
          file_size: formatFileSize(file.size),
          action: 'created'
        });

      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
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
    console.error("Error in bulk upload:", error);
    
    if (req.files) {
      await cleanupFiles(req.files);
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

    if (category_id) {
      query += " AND f.category_id = ?";
      params.push(category_id);
    }

    if (folder_id !== undefined) {
      if (folder_id === 'null' || folder_id === '') {
        query += " AND f.folder_id IS NULL";
      } else {
        query += " AND f.folder_id = ?";
        params.push(folder_id);
      }
    }

    if (file_type) {
      query += " AND f.file_type = ?";
      params.push(file_type);
    }

    if (is_starred !== undefined) {
      query += " AND f.is_starred = ?";
      params.push(is_starred === 'true' ? 1 : 0);
    }

    if (is_active !== undefined) {
      query += " AND f.is_active = ?";
      params.push(is_active === 'true' ? 1 : 0);
    }

    if (search) {
      query += " AND (f.name LIKE ? OR f.original_name LIKE ?)";
      const searchTerm = `%${sanitizeInput(search)}%`;
      params.push(searchTerm, searchTerm);
    }

    query += " ORDER BY f.created_at DESC";

    if (limit) {
      query += " LIMIT ?";
      params.push(parseInt(limit));
      
      if (offset) {
        query += " OFFSET ?";
        params.push(parseInt(offset));
      }
    }

    const [files] = await db.promise().query(query, params);

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
    console.error("Error getting files:", error);
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
    console.error("Error getting file:", error);
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

    const [existingFiles] = await db.promise().query("SELECT * FROM categories_files WHERE id = ?", [id]);
    if (existingFiles.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const currentFile = existingFiles[0];

    const userValid = await validateUser(updated_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid updated_by user" });
    }

    if (category_id && category_id !== currentFile.category_id) {
      const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [category_id]);
      if (categoryRows.length === 0) {
        return res.status(400).json({ error: "Invalid category_id" });
      }
    }

    if (folder_id && folder_id !== currentFile.folder_id) {
      const finalCategoryId = category_id || currentFile.category_id;
      const [folderRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ? AND category_id = ?", [folder_id, finalCategoryId]);
      if (folderRows.length === 0) {
        return res.status(400).json({ error: "Invalid folder_id for this category" });
      }
    }

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

    await db.promise().query(
      `UPDATE categories_files SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    const actionType = (name && name !== currentFile.name) ? 'rename' : 'update';
    const actionInfo = folder_id !== currentFile.folder_id ? 'Moved to different folder' : null;
    await addActivityLog(updated_by, actionType, 'file', id, name || currentFile.name, actionInfo);

    res.json({
      message: "File updated successfully"
    });

  } catch (error) {
    console.error("Error updating file:", error);
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

    const userValid = await validateUser(deleted_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid deleted_by user" });
    }

    const [existingFiles] = await db.promise().query("SELECT * FROM categories_files WHERE id = ?", [id]);
    if (existingFiles.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = existingFiles[0];

    try {
      if (validateFilePath(file.file_path)) {
        await unlinkAsync(file.file_path);
      }
    } catch (fileError) {
      console.error("Error deleting physical file:", fileError);
    }

    await db.promise().query("DELETE FROM categories_files WHERE id = ?", [id]);

    await addActivityLog(deleted_by, 'delete', 'file', id, file.name, `Size: ${formatFileSize(file.file_size)}`);

    res.json({
      message: "File deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting file:", error);
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

    const userValid = await validateUser(moved_by);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid moved_by user" });
    }

    const [categoryRows] = await db.promise().query("SELECT id FROM categories WHERE id = ?", [target_category_id]);
    if (categoryRows.length === 0) {
      return res.status(400).json({ error: "Invalid target_category_id" });
    }

    if (target_folder_id) {
      const [folderRows] = await db.promise().query("SELECT id FROM categories_folders WHERE id = ? AND category_id = ?", [target_folder_id, target_category_id]);
      if (folderRows.length === 0) {
        return res.status(400).json({ error: "Invalid target_folder_id for this category" });
      }
    }

    const results = { moved: [], errors: [] };

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
        console.error(`Error moving file ${file_id}:`, error);
        results.errors.push({ file_id, error: "Failed to move file" });
      }
    }

    res.json({
      message: `Move completed: ${results.moved.length} moved, ${results.errors.length} errors`,
      results: results
    });

  } catch (error) {
    console.error("Error moving multiple files:", error);
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

        const originalPath = originalFile.file_path;
        const newPath = originalPath.replace(path.basename(originalPath), `${Date.now()}-${path.basename(originalPath)}`);
        
        await fs.promises.copyFile(originalPath, newPath);

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
        console.error(`Error copying file ${file_id}:`, error);
        results.errors.push({ file_id, error: "Failed to copy file" });
      }
    }

    res.json({
      message: `Copy completed: ${results.copied.length} copied, ${results.errors.length} errors`,
      results: results
    });

  } catch (error) {
    console.error("Error copying multiple files:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
/*
// ================== Download File ==================
router.get('/files/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid file ID is required" });
    }

    const [files] = await db.promise().query("SELECT * FROM categories_files WHERE id = ? AND is_active = 1", [id]);
    if (files.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = files[0];

    if (!validateFilePath(file.file_path)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: "Physical file not found" });
    }

    await db.promise().query(
      "UPDATE categories_files SET download_count = download_count + 1, last_accessed = NOW() WHERE id = ?",
      [id]
    );

    if (user_id) {
      await addActivityLog(user_id, 'download', 'file', id, file.name, `Size: ${formatFileSize(file.file_size)}`);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Length', file.file_size);

    const fileStream = fs.createReadStream(file.file_path);
    fileStream.pipe(res);

  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
*/
// ================== Download File ==================
router.get('/files/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, preview } = req.query;  // Add 'preview' parameter

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid file ID is required" });
    }

    const [files] = await db.promise().query("SELECT * FROM categories_files WHERE id = ? AND is_active = 1", [id]);
    if (files.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = files[0];

    if (!validateFilePath(file.file_path)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: "Physical file not found" });
    }

    // Only log and increment download count if NOT a preview
    if (preview !== 'true') {
      await db.promise().query(
        "UPDATE categories_files SET download_count = download_count + 1, last_accessed = NOW() WHERE id = ?",
        [id]
      );

      if (user_id) {
        await addActivityLog(user_id, 'download', 'file', id, file.name, `Size: ${formatFileSize(file.file_size)}`);
      }
    } else {
      // Just update last_accessed for previews, no activity log
      await db.promise().query(
        "UPDATE categories_files SET last_accessed = NOW() WHERE id = ?",
        [id]
      );
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Length', file.file_size);

    const fileStream = fs.createReadStream(file.file_path);
    fileStream.pipe(res);

  } catch (error) {
    console.error("Error downloading file:", error);
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

    const userValid = await validateUser(user_id);
    if (!userValid) {
      return res.status(400).json({ error: "Invalid user_id" });
    }

    const [existingFiles] = await db.promise().query("SELECT * FROM categories_files WHERE id = ?", [id]);
    if (existingFiles.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = existingFiles[0];
    const newStarredStatus = is_starred !== undefined ? (is_starred ? 1 : 0) : (file.is_starred ? 0 : 1);

    await db.promise().query(
      "UPDATE categories_files SET is_starred = ?, updated_by = ?, updated_at = NOW() WHERE id = ?",
      [newStarredStatus, user_id, id]
    );

    const action = newStarredStatus ? 'starred' : 'unstarred';
    await addActivityLog(user_id, 'update', 'file', id, file.name, `File ${action}`);

    res.json({
      message: `File ${newStarredStatus ? 'starred' : 'unstarred'} successfully`,
      is_starred: newStarredStatus === 1
    });

  } catch (error) {
    console.error("Error toggling file star:", error);
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
    console.error("Error getting file statistics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== Error Handler Middleware ==================
router.use(handleMulterError);

module.exports = router;