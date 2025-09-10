/*
const express = require("express");
const multer = require("multer");
const path = require("path");
const db = require("../db");
const fs = require("fs");
const util = require("util");
const unlinkAsync = util.promisify(fs.unlink);

const router = express.Router();

// ================== Helper: Validate User ==================
async function validateUser(userId) {
  console.log("🔍 Validating user ID:", userId, "Type:", typeof userId);
  
  try {
    const [rows] = await db.promise().query("SELECT id, name FROM users WHERE id = ?", [userId]);
    console.log("📋 User validation query result:", rows);
    
    if (rows.length > 0) {
      console.log("✅ User found:", rows[0]);
      return true;
    } else {
      console.log("❌ No user found with ID:", userId);
      return false;
    }
  } catch (error) {
    console.error("💥 Error validating user:", error);
    return false;
  }
}

// ================== Helper: Get User Details ==================
async function getUserDetails(userId) {
  try {
    const [rows] = await db.promise().query("SELECT id, name, user_name FROM users WHERE id = ?", [userId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error("Error getting user details:", error);
    return null;
  }
}

// ================== Configure Storage ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("📁 Setting upload destination: uploads/");
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + "-" + file.originalname;
    console.log("📝 Generated filename:", filename);
    cb(null, filename);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("🔍 File filter check:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    cb(null, true);
  }
});

// ================== Create Folder ==================
router.post("/folders", async (req, res) => {
  console.log("\n🆕 ===== CREATE FOLDER REQUEST =====");
  console.log("📥 Request body:", req.body);
  console.log("🌐 Request headers:", req.headers);
  
  const { name, parent_id, created_by } = req.body;
  
  // Debug logging
  console.log("📊 Extracted values:");
  console.log("  - name:", name, "Type:", typeof name);
  console.log("  - parent_id:", parent_id, "Type:", typeof parent_id);
  console.log("  - created_by:", created_by, "Type:", typeof created_by);
  
  try {
    // Validate required fields
    if (!name || name.trim() === '') {
      console.log("❌ Missing or empty folder name");
      return res.status(400).json({ error: "Folder name is required" });
    }
    
    if (!created_by) {
      console.log("❌ Missing created_by user ID");
      return res.status(400).json({ error: "created_by user ID is required" });
    }
    
    // Validate user exists
    console.log("🔍 Validating user...");
    const userExists = await validateUser(created_by);
    if (!userExists) {
      console.log("❌ User validation failed for ID:", created_by);
      return res.status(400).json({ error: "Invalid created_by user" });
    }
    
    // Check if parent folder exists (if provided)
    if (parent_id) {
      console.log("🔍 Checking parent folder:", parent_id);
      const [parentCheck] = await db.promise().query("SELECT id FROM folders WHERE id = ?", [parent_id]);
      if (parentCheck.length === 0) {
        console.log("❌ Parent folder not found:", parent_id);
        return res.status(400).json({ error: "Parent folder not found" });
      }
      console.log("✅ Parent folder exists");
    }
    
    // Check for duplicate folder names in the same parent
    const duplicateCheck = parent_id 
      ? await db.promise().query("SELECT id FROM folders WHERE name = ? AND parent_id = ?", [name.trim(), parent_id])
      : await db.promise().query("SELECT id FROM folders WHERE name = ? AND parent_id IS NULL", [name.trim()]);
    
    if (duplicateCheck[0].length > 0) {
      console.log("❌ Duplicate folder name found");
      return res.status(400).json({ error: "A folder with this name already exists in the same location" });
    }
    
    console.log("💾 Inserting folder into database...");
    const [result] = await db.promise().query(
      `INSERT INTO folders (name, parent_id, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [name.trim(), parent_id || null, created_by, created_by]
    );
    
    console.log("✅ Folder created successfully!");
    console.log("📋 Insert result:", result);
    console.log("🆔 New folder ID:", result.insertId);
    
    // Get user details for response
    const userDetails = await getUserDetails(created_by);
    
    res.json({ 
      message: "✅ Folder created successfully",
      folderId: result.insertId,
      folderName: name.trim(),
      createdBy: userDetails,
      parentId: parent_id || null
    });
    
    await addActivityLog(created_by, "create", "folder", result.insertId, name);

  } catch (err) {
    console.error("💥 Error creating folder:", err);
    console.error("📋 Error stack:", err.stack);
    res.status(500).json({ error: "Failed to create folder: " + err.message });
  }

  
});

// ================== Upload File ==================
router.post("/upload", upload.single("file"), async (req, res) => {
  console.log("\n📤 ===== FILE UPLOAD REQUEST =====");
  console.log("📥 Request body:", req.body);
  console.log("📎 File info:", req.file);
  
  const { folder_id, created_by } = req.body;
  
  console.log("📊 Extracted values:");
  console.log("  - folder_id:", folder_id, "Type:", typeof folder_id);
  console.log("  - created_by:", created_by, "Type:", typeof created_by);
  
  try {
    // Validate file
    const file = req.file;
    if (!file) {
      console.log("❌ No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    console.log("📋 File details:");
    console.log("  - Original name:", file.originalname);
    console.log("  - File path:", file.path);
    console.log("  - File size:", file.size);
    console.log("  - Mime type:", file.mimetype);
    
    // Validate created_by
    if (!created_by) {
      console.log("❌ Missing created_by user ID");
      return res.status(400).json({ error: "created_by user ID is required" });
    }
    
    console.log("🔍 Validating user...");
    const userExists = await validateUser(created_by);
    if (!userExists) {
      console.log("❌ User validation failed for ID:", created_by);
      return res.status(400).json({ error: "Invalid created_by user" });
    }
    
    // Validate folder exists (if provided)
    if (folder_id) {
      console.log("🔍 Checking folder:", folder_id);
      const [folderCheck] = await db.promise().query("SELECT id FROM folders WHERE id = ?", [folder_id]);
      if (folderCheck.length === 0) {
        console.log("❌ Folder not found:", folder_id);
        return res.status(400).json({ error: "Folder not found" });
      }
      console.log("✅ Folder exists");
    }
    
    // Check for duplicate file names in the same folder
    const duplicateCheck = folder_id 
      ? await db.promise().query("SELECT id FROM files WHERE file_name = ? AND folder_id = ?", [file.originalname, folder_id])
      : await db.promise().query("SELECT id FROM files WHERE file_name = ? AND folder_id IS NULL", [file.originalname]);
    
    if (duplicateCheck[0].length > 0) {
      console.log("❌ Duplicate file name found");
      return res.status(400).json({ error: "A file with this name already exists in the same location" });
    }
    
    console.log("💾 Inserting file into database...");
    const [result] = await db.promise().query(
      `INSERT INTO files (folder_id, file_name, file_path, file_type, file_size, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        folder_id || null,
        file.originalname,
        file.path,
        path.extname(file.originalname).substring(1).toLowerCase(),
        file.size,
        created_by,
        created_by,
      ]
    );

    console.log("✅ File uploaded successfully!");
    console.log("📋 Insert result:", result);
    console.log("🆔 New file ID:", result.insertId);
    
    // Get user details for response
    const userDetails = await getUserDetails(created_by);
    
    res.json({ 
      message: "✅ File uploaded successfully",
      fileId: result.insertId,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: path.extname(file.originalname).substring(1).toLowerCase(),
      createdBy: userDetails,
      folderId: folder_id || null
    });

    await addActivityLog(created_by, "upload", "file", result.insertId, file.originalname);
    
  } catch (err) {
    console.error("💥 Error uploading file:", err);
    console.error("📋 Error stack:", err.stack);
    
    // Clean up uploaded file if database insert failed
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        await unlinkAsync(req.file.path);
        console.log("🧹 Cleaned up uploaded file after error");
      } catch (cleanupError) {
        console.error("💥 Error cleaning up file:", cleanupError);
      }
    }
    
    res.status(500).json({ error: "Failed to upload file: " + err.message });
  }
});

// ================== Get Files (Root & Subfolders) ==================
router.get("/list", async (req, res) => {
  console.log("\n📂 ===== GET ROOT FILES/FOLDERS =====");
  
  try {
    console.log("🔍 Querying root files...");
    const [files] = await db.promise().query(
      `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name
       FROM files f
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users u2 ON f.updated_by = u2.id
       WHERE folder_id IS NULL
       ORDER BY f.file_name ASC`
    );
    
    console.log("🔍 Querying root folders...");
    const [folders] = await db.promise().query(
      `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name
       FROM folders f
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users u2 ON f.updated_by = u2.id
       WHERE parent_id IS NULL
       ORDER BY f.name ASC`
    );
    
    console.log("📊 Query results:");
    console.log("  - Files found:", files.length);
    console.log("  - Folders found:", folders.length);
    
    res.json({ 
      folders: folders || [], 
      files: files || [],
      location: "root"
    });
    
  } catch (err) {
    console.error("💥 Error getting root files/folders:", err);
    res.status(500).json({ error: "Failed to get files/folders: " + err.message });
  }
});

router.get("/list/:folderId", async (req, res) => {
  const { folderId } = req.params;
  
  console.log("\n📂 ===== GET FOLDER CONTENTS =====");
  console.log("📁 Folder ID:", folderId);
  
  try {
    // Validate folder exists
    console.log("🔍 Checking if folder exists...");
    const [folderCheck] = await db.promise().query("SELECT * FROM folders WHERE id = ?", [folderId]);
    if (folderCheck.length === 0) {
      console.log("❌ Folder not found:", folderId);
      return res.status(404).json({ error: "Folder not found" });
    }
    
    const folderInfo = folderCheck[0];
    console.log("✅ Folder found:", folderInfo.name);
    
    console.log("🔍 Querying files in folder...");
    const [files] = await db.promise().query(
      `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name
       FROM files f
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users u2 ON f.updated_by = u2.id
       WHERE folder_id = ?
       ORDER BY f.file_name ASC`,
      [folderId]
    );
    
    console.log("🔍 Querying subfolders...");
    const [folders] = await db.promise().query(
      `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name
       FROM folders f
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users u2 ON f.updated_by = u2.id
       WHERE parent_id = ?
       ORDER BY f.name ASC`,
      [folderId]
    );
    
    console.log("📊 Query results:");
    console.log("  - Files found:", files.length);
    console.log("  - Subfolders found:", folders.length);
    
    res.json({ 
      folders: folders || [], 
      files: files || [],
      currentFolder: folderInfo,
      location: folderInfo.name
    });
    
  } catch (err) {
    console.error("💥 Error getting folder contents:", err);
    res.status(500).json({ error: "Failed to get folder contents: " + err.message });
  }
});

// ================== Get Folder Path (Breadcrumb) ==================
router.get("/path/:folderId", async (req, res) => {
  const { folderId } = req.params;
  
  console.log("\n🧭 ===== GET FOLDER PATH =====");
  console.log("📁 Folder ID:", folderId);
  
  try {
    const path = [];
    let currentId = folderId;
    
    while (currentId) {
      const [folderResult] = await db.promise().query(
        "SELECT id, name, parent_id FROM folders WHERE id = ?",
        [currentId]
      );
      
      if (folderResult.length === 0) break;
      
      const folder = folderResult[0];
      path.unshift(folder); // Add to beginning of array
      currentId = folder.parent_id;
    }
    
    console.log("🧭 Folder path:", path);
    res.json({ path });
    
  } catch (err) {
    console.error("💥 Error getting folder path:", err);
    res.status(500).json({ error: "Failed to get folder path: " + err.message });
  }
});

// ================== Download File ==================
router.get("/download/:id", async (req, res) => {
  const { id } = req.params;
  
  console.log("\n⬇️ ===== DOWNLOAD FILE =====");
  console.log("📎 File ID:", id);
  
  try {
    console.log("🔍 Querying file details...");
    const [result] = await db.promise().query("SELECT * FROM files WHERE id = ?", [id]);
    
    if (result.length === 0) {
      console.log("❌ File not found in database:", id);
      return res.status(404).json({ error: "File not found" });
    }

    const file = result[0];
    console.log("📋 File details:", {
      id: file.id,
      name: file.file_name,
      path: file.file_path,
      size: file.file_size
    });
    
    console.log("🔍 Checking if file exists on disk...");
    if (!fs.existsSync(file.file_path)) {
      console.log("❌ File missing on server:", file.file_path);
      return res.status(404).json({ error: "File missing on server" });
    }

    console.log("✅ File found, starting download...");
    res.download(file.file_path, file.file_name, (err) => {
      await addActivityLog(file.created_by, "download", "file", file.id, file.file_name);
      if (err) {
        console.error("💥 Error during download:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Download failed" });
        }
        
      } else {
        console.log("✅ Download completed successfully");
      }
    });
    
  } catch (err) {
    console.error("💥 Error downloading file:", err);
    res.status(500).json({ error: "Download failed: " + err.message });
  }
});

// ================== Delete File/Folder ==================
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { updated_by } = req.body;
  
  console.log("\n🗑️ ===== DELETE REQUEST =====");
  console.log("🆔 Item ID:", id);
  console.log("👤 Updated by:", updated_by);
  
  try {
    // Validate updated_by user
    if (!updated_by) {
      console.log("❌ Missing updated_by user ID");
      return res.status(400).json({ error: "updated_by user ID is required" });
    }
    
    console.log("🔍 Validating user...");
    const userExists = await validateUser(updated_by);
    if (!userExists) {
      console.log("❌ User validation failed for ID:", updated_by);
      return res.status(400).json({ error: "Invalid updated_by user" });
    }

    // --- Check if it's a file ---
    console.log("🔍 Checking if item is a file...");
    const [fileResult] = await db.promise().query("SELECT * FROM files WHERE id = ?", [id]);
    
    if (fileResult.length > 0) {
      console.log("📎 Found file to delete:", fileResult[0].file_name);
      const file = fileResult[0];
      
      // Delete physical file
      if (file.file_path && fs.existsSync(file.file_path)) {
        await addActivityLog(updated_by, "delete", "file", file.id, file.file_name);
        console.log("🗑️ Deleting physical file:", file.file_path);
        await unlinkAsync(file.file_path);
        console.log("✅ Physical file deleted");
      } else {
        console.log("⚠️ Physical file not found on disk:", file.file_path);
      }
      
      // Delete database record
      console.log("🗑️ Deleting file from database...");
      await db.promise().query("DELETE FROM files WHERE id = ?", [id]);
      console.log("✅ File deleted from database");
      
      return res.json({ 
        message: "✅ File deleted successfully",
        deletedItem: {
          type: "file",
          id: file.id,
          name: file.file_name
        }
      });
    }

    // --- Check if it's a folder ---
    console.log("🔍 Checking if item is a folder...");
    const [folderResult] = await db.promise().query("SELECT * FROM folders WHERE id = ?", [id]);
    
    if (folderResult.length > 0) {
      console.log("📁 Found folder to delete:", folderResult[0].name);
      
      // Check for contained files
      console.log("🔍 Checking for files in folder...");
      const [containedFiles] = await db.promise().query("SELECT id, file_name FROM files WHERE folder_id = ?", [id]);
      
      // Check for contained folders
      console.log("🔍 Checking for subfolders...");
      const [containedFolders] = await db.promise().query("SELECT id, name FROM folders WHERE parent_id = ?", [id]);

      console.log("📊 Folder contents:");
      console.log("  - Files:", containedFiles.length);
      console.log("  - Subfolders:", containedFolders.length);

      if (containedFiles.length > 0 || containedFolders.length > 0) {
        console.log("❌ Cannot delete non-empty folder");
        return res.status(400).json({ 
          error: "Cannot delete non-empty folder. Please delete its contents first.",
          containedFiles: containedFiles.map(f => f.file_name),
          containedFolders: containedFolders.map(f => f.name)
        });
      }

      console.log("🗑️ Deleting empty folder from database...");
      await db.promise().query("DELETE FROM folders WHERE id = ?", [id]);
      console.log("✅ Folder deleted from database");
      
      return res.json({ 
        message: "✅ Folder deleted successfully",
        deletedItem: {
          type: "folder",
          id: folderResult[0].id,
          name: folderResult[0].name
        }
      });
    }

    console.log("❌ Item not found (neither file nor folder)");
    return res.status(404).json({ error: "Item not found" });
    
  } catch (err) {
    console.error("💥 Error during deletion:", err);
    console.error("📋 Error stack:", err.stack);
    res.status(500).json({ error: "Delete failed: " + err.message });
  }
});

// ================== Search Files/Folders ==================
router.get("/search", async (req, res) => {
  const { q: query, type } = req.query;
  
  console.log("\n🔍 ===== SEARCH REQUEST =====");
  console.log("🔎 Query:", query);
  console.log("📂 Type filter:", type);
  
  try {
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: "Search query is required" });
    }
    
    const searchTerm = `%${query.trim()}%`;
    let results = { files: [], folders: [] };
    
    // Search files
    if (!type || type === 'file') {
      console.log("🔍 Searching files...");
      const [files] = await db.promise().query(
        `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name,
                fo.name AS folder_name
         FROM files f
         LEFT JOIN users u ON f.created_by = u.id
         LEFT JOIN users u2 ON f.updated_by = u2.id
         LEFT JOIN folders fo ON f.folder_id = fo.id
         WHERE f.file_name LIKE ?
         ORDER BY f.file_name ASC`,
        [searchTerm]
      );
      results.files = files;
      console.log("📎 Files found:", files.length);
    }
    
    // Search folders
    if (!type || type === 'folder') {
      console.log("🔍 Searching folders...");
      const [folders] = await db.promise().query(
        `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name,
                pf.name AS parent_folder_name
         FROM folders f
         LEFT JOIN users u ON f.created_by = u.id
         LEFT JOIN users u2 ON f.updated_by = u2.id
         LEFT JOIN folders pf ON f.parent_id = pf.id
         WHERE f.name LIKE ?
         ORDER BY f.name ASC`,
        [searchTerm]
      );
      results.folders = folders;
      console.log("📁 Folders found:", folders.length);
    }
    
    console.log("✅ Search completed");
    res.json({
      query: query.trim(),
      results: results,
      totalResults: results.files.length + results.folders.length
    });
    
  } catch (err) {
    console.error("💥 Error during search:", err);
    res.status(500).json({ error: "Search failed: " + err.message });
  }
});

// ================== Get Statistics ==================
router.get("/stats", async (req, res) => {
  console.log("\n📊 ===== GET STATISTICS =====");
  
  try {
    // Get total counts
    const [fileCount] = await db.promise().query("SELECT COUNT(*) as count FROM files");
    const [folderCount] = await db.promise().query("SELECT COUNT(*) as count FROM folders");
    
    // Get total file size
    const [sizeResult] = await db.promise().query("SELECT SUM(file_size) as total_size FROM files");
    const totalSize = sizeResult[0].total_size || 0;
    
    // Get file type distribution
    const [fileTypes] = await db.promise().query(`
      SELECT file_type, COUNT(*) as count, SUM(file_size) as total_size
      FROM files 
      WHERE file_type IS NOT NULL AND file_type != ''
      GROUP BY file_type 
      ORDER BY count DESC
      LIMIT 10
    `);
    
    const stats = {
      totalFiles: fileCount[0].count,
      totalFolders: folderCount[0].count,
      totalSize: totalSize,
      totalSizeFormatted: formatFileSize(totalSize),
      fileTypes: fileTypes
    };
    
    console.log("📊 Statistics:", stats);
    res.json(stats);
    
  } catch (err) {
    console.error("💥 Error getting statistics:", err);
    res.status(500).json({ error: "Failed to get statistics: " + err.message });
  }
});

// ================== Helper: Format File Size ==================
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ================== Error Handler ==================
router.use((error, req, res, next) => {
  console.error("💥 Unhandled error in files router:", error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: "Unexpected file field." });
    }
  }
  
  res.status(500).json({ error: "Internal server error: " + error.message });
});

console.log("📁 Files router loaded with debug logging enabled");

// ================== Helper: Add Activity Log ==================
async function addActivityLog(userId, action, targetType, targetId, targetName) {
  try {
    await db.promise().query(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, target_name, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, action, targetType, targetId, targetName]
    );
    console.log(`📝 Log: ${action} ${targetType} (${targetName}) by user ${userId}`);
  } catch (error) {
    console.error("💥 Error adding activity log:", error);
  }
}

// ================== Get Activity Logs ==================
router.get("/activity-logs", async (req, res) => {
  const { user_id, action, target_type } = req.query;

  let sql = `SELECT al.*, u.name AS user_name
             FROM activity_logs al
             JOIN users u ON al.user_id = u.id
             WHERE 1=1`;
  const params = [];

  if (user_id) {
    sql += " AND al.user_id = ?";
    params.push(user_id);
  }
  if (action) {
    sql += " AND al.action = ?";
    params.push(action);
  }
  if (target_type) {
    sql += " AND al.target_type = ?";
    params.push(target_type);
  }

  sql += " ORDER BY al.created_at DESC LIMIT 100";

  try {
    const [rows] = await db.promise().query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching activity logs:", err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

module.exports = router;

*/
const express = require("express");
const multer = require("multer");
const path = require("path");
const db = require("../db");
const fs = require("fs");
const util = require("util");
const validator = require("validator");
const unlinkAsync = util.promisify(fs.unlink);

const router = express.Router();

// ================== Security Configuration ==================
const ALLOWED_FILE_TYPES = [
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', // Images
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', // Documents
  'txt', 'csv', 'json', 'xml', 'html', 'css', 'js', // Text files
  'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', // Video
  'mp3', 'wav', 'flac', 'aac', 'ogg', // Audio
  'zip', 'rar', '7z', 'tar', 'gz' // Archives
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES_PER_REQUEST = 10;

// ================== Helper: Validate User ==================
async function validateUser(userId) {
  console.log("🔍 Validating user ID:", userId, "Type:", typeof userId);
  
  try {
    const [rows] = await db.promise().query("SELECT id, name FROM users WHERE id = ?", [userId]);
    console.log("📋 User validation query result:", rows);
    
    if (rows.length > 0) {
      console.log("✅ User found:", rows[0]);
      return true;
    } else {
      console.log("❌ No user found with ID:", userId);
      return false;
    }
  } catch (error) {
    console.error("💥 Error validating user:", error);
    return false;
  }
}

// ================== Helper: Get User Details ==================
async function getUserDetails(userId) {
  try {
    const [rows] = await db.promise().query("SELECT id, name, user_name FROM users WHERE id = ?", [userId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error("Error getting user details:", error);
    return null;
  }
}

// ================== Helper: Validate File Path ==================
function validateFilePath(filePath) {
  const normalizedPath = path.normalize(filePath);
  // Just check for path traversal attacks, allow any path containing 'uploads'
  return !normalizedPath.includes('..') && normalizedPath.includes('uploads');
}

// ================== Helper: Validate File Type ==================
function validateFileType(filename) {
  const ext = path.extname(filename).substring(1).toLowerCase();
  return ALLOWED_FILE_TYPES.includes(ext);
}

// ================== Helper: Sanitize Input ==================
function sanitizeInput(input) {
  if (!input) return input;
  return validator.escape(input.toString().trim());
}

// ================== Helper: Format File Size ==================
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ================== Helper: Add Activity Log ==================
async function addActivityLog(userId, action, targetType, targetId, targetName, additionalInfo = null) {
  try {
    const actionMap = {
      'create': 'CREATE',
      'upload': 'CREATE', 
      'update': 'UPDATE',
      'rename': 'RENAME',
      'move': 'MOVE',
      'move_rename': 'MOVE',
      'delete': 'DELETE',
      'download': 'DOWNLOAD',
      'copy': 'COPY'
    };

    const entityTypeMap = {
      'file': 'FILE',
      'folder': 'FOLDER'
    };

    const mappedAction = actionMap[action] || 'CREATE';
    const mappedEntityType = entityTypeMap[targetType] || 'FILE';

    await db.promise().query(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, target_name, additional_info, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [userId, mappedAction, mappedEntityType, targetId, targetName, additionalInfo]
    );
    
    console.log(`📝 Log: ${mappedAction} ${mappedEntityType} (${targetName}) by user ${userId}`);
  } catch (error) {
    console.error("💥 Error adding activity log:", error);
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

// ================== Create Folder ==================
router.post("/folders", async (req, res) => {
  console.log("\n🆕 ===== CREATE FOLDER REQUEST =====");
  console.log("📥 Request body:", req.body);
  
  const { name, parent_id, created_by } = req.body;
  
  // Debug logging
  console.log("📊 Extracted values:");
  console.log("  - name:", name, "Type:", typeof name);
  console.log("  - parent_id:", parent_id, "Type:", typeof parent_id);
  console.log("  - created_by:", created_by, "Type:", typeof created_by);
  
  try {
    // Validate required fields
    if (!name || name.trim() === '') {
      console.log("❌ Missing or empty folder name");
      return res.status(400).json({ error: "Folder name is required" });
    }
    
    if (!created_by) {
      console.log("❌ Missing created_by user ID");
      return res.status(400).json({ error: "created_by user ID is required" });
    }
    
    // Sanitize input
    const sanitizedName = sanitizeInput(name);
    
    // Validate user exists
    console.log("🔍 Validating user...");
    const userExists = await validateUser(created_by);
    if (!userExists) {
      console.log("❌ User validation failed for ID:", created_by);
      return res.status(400).json({ error: "Invalid created_by user" });
    }
    
    // Check if parent folder exists (if provided)
    if (parent_id) {
      console.log("🔍 Checking parent folder:", parent_id);
      const [parentCheck] = await db.promise().query("SELECT id FROM folders WHERE id = ?", [parent_id]);
      if (parentCheck.length === 0) {
        console.log("❌ Parent folder not found:", parent_id);
        return res.status(400).json({ error: "Parent folder not found" });
      }
      console.log("✅ Parent folder exists");
    }
    
    // Check for duplicate folder names in the same parent
    const duplicateCheck = parent_id 
      ? await db.promise().query("SELECT id FROM folders WHERE name = ? AND parent_id = ?", [sanitizedName, parent_id])
      : await db.promise().query("SELECT id FROM folders WHERE name = ? AND parent_id IS NULL", [sanitizedName]);
    
    if (duplicateCheck[0].length > 0) {
      console.log("❌ Duplicate folder name found");
      return res.status(400).json({ error: "A folder with this name already exists in the same location" });
    }
    
    console.log("💾 Inserting folder into database...");
    const [result] = await db.promise().query(
      `INSERT INTO folders (name, parent_id, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [sanitizedName, parent_id || null, created_by, created_by]
    );
    
    console.log("✅ Folder created successfully!");
    console.log("📋 Insert result:", result);
    console.log("🆔 New folder ID:", result.insertId);
    
    // Get user details for response
    const userDetails = await getUserDetails(created_by);
    
    res.json({ 
      message: "Folder created successfully",
      folderId: result.insertId,
      folderName: sanitizedName,
      createdBy: userDetails,
      parentId: parent_id || null
    });
    
    await addActivityLog(created_by, "create", "folder", result.insertId, sanitizedName);

  } catch (err) {
    console.error("💥 Error creating folder:", err);
    console.error("📋 Error stack:", err.stack);
    res.status(500).json({ error: "Failed to create folder: " + err.message });
  }
});

// ================== Upload File (Single) ==================
router.post("/upload", upload.single("file"), async (req, res) => {
  console.log("\n📤 ===== FILE UPLOAD REQUEST =====");
  console.log("📥 Request body:", req.body);
  console.log("📎 File info:", req.file);
  
  const { folder_id, created_by } = req.body;
  
  console.log("📊 Extracted values:");
  console.log("  - folder_id:", folder_id, "Type:", typeof folder_id);
  console.log("  - created_by:", created_by, "Type:", typeof created_by);
  
  try {
    // Validate file
    const file = req.file;
    if (!file) {
      console.log("❌ No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    // Validate file path
    if (!validateFilePath(file.path)) {
      console.log("❌ Invalid file path:", file.path);
      await unlinkAsync(file.path);
      return res.status(400).json({ error: "Invalid file path" });
    }
    
    console.log("📋 File details:");
    console.log("  - Original name:", file.originalname);
    console.log("  - File path:", file.path);
    console.log("  - File size:", file.size);
    console.log("  - Mime type:", file.mimetype);
    
    // Validate created_by
    if (!created_by) {
      console.log("❌ Missing created_by user ID");
      await unlinkAsync(file.path);
      return res.status(400).json({ error: "created_by user ID is required" });
    }
    
    console.log("🔍 Validating user...");
    const userExists = await validateUser(created_by);
    if (!userExists) {
      console.log("❌ User validation failed for ID:", created_by);
      await unlinkAsync(file.path);
      return res.status(400).json({ error: "Invalid created_by user" });
    }
    
    // Validate folder exists (if provided)
    if (folder_id) {
      console.log("🔍 Checking folder:", folder_id);
      const [folderCheck] = await db.promise().query("SELECT id FROM folders WHERE id = ?", [folder_id]);
      if (folderCheck.length === 0) {
        console.log("❌ Folder not found:", folder_id);
        await unlinkAsync(file.path);
        return res.status(400).json({ error: "Folder not found" });
      }
      console.log("✅ Folder exists");
    }
    
    // Check for duplicate file names in the same folder
    const duplicateCheck = folder_id 
      ? await db.promise().query("SELECT id FROM files WHERE file_name = ? AND folder_id = ?", [file.originalname, folder_id])
      : await db.promise().query("SELECT id FROM files WHERE file_name = ? AND folder_id IS NULL", [file.originalname]);
    
    if (duplicateCheck[0].length > 0) {
      console.log("❌ Duplicate file name found");
      await unlinkAsync(file.path);
      return res.status(400).json({ error: "A file with this name already exists in the same location" });
    }
    
    console.log("💾 Inserting file into database...");
    const [result] = await db.promise().query(
      `INSERT INTO files (folder_id, file_name, file_path, file_type, file_size, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        folder_id || null,
        file.originalname,
        file.path,
        path.extname(file.originalname).substring(1).toLowerCase(),
        file.size,
        created_by,
        created_by,
      ]
    );

    console.log("✅ File uploaded successfully!");
    console.log("📋 Insert result:", result);
    console.log("🆔 New file ID:", result.insertId);
    
    // Get user details for response
    const userDetails = await getUserDetails(created_by);
    
    res.json({ 
      message: "File uploaded successfully",
      fileId: result.insertId,
      fileName: file.originalname,
      fileSize: file.size,
      fileSizeFormatted: formatFileSize(file.size),
      fileType: path.extname(file.originalname).substring(1).toLowerCase(),
      createdBy: userDetails,
      folderId: folder_id || null
    });

    await addActivityLog(created_by, "upload", "file", result.insertId, file.originalname, JSON.stringify({ size: file.size, type: file.mimetype }));
    
  } catch (err) {
    console.error("💥 Error uploading file:", err);
    console.error("📋 Error stack:", err.stack);
    
    // Clean up uploaded file if database insert failed
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        await unlinkAsync(req.file.path);
        console.log("🧹 Cleaned up uploaded file after error");
      } catch (cleanupError) {
        console.error("💥 Error cleaning up file:", cleanupError);
      }
    }
    
    res.status(500).json({ error: "Failed to upload file: " + err.message });
  }
});

// ================== Upload Multiple Files ==================
router.post("/upload/multiple", upload.array("files", MAX_FILES_PER_REQUEST), async (req, res) => {
  console.log("\n📤 ===== MULTIPLE FILE UPLOAD REQUEST =====");
  console.log("📥 Request body:", req.body);
  console.log("📎 Files count:", req.files?.length || 0);
  
  const { folder_id, created_by } = req.body;
  const uploadedFiles = [];
  const errors = [];
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    
    // Validate user
    const userExists = await validateUser(created_by);
    if (!userExists) {
      // Clean up all uploaded files
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          await unlinkAsync(file.path);
        }
      }
      return res.status(400).json({ error: "Invalid created_by user" });
    }
    
    // Validate folder (if provided)
    if (folder_id) {
      const [folderCheck] = await db.promise().query("SELECT id FROM folders WHERE id = ?", [folder_id]);
      if (folderCheck.length === 0) {
        // Clean up all uploaded files
        for (const file of req.files) {
          if (fs.existsSync(file.path)) {
            await unlinkAsync(file.path);
          }
        }
        return res.status(400).json({ error: "Folder not found" });
      }
    }
    
    // Process each file
    for (const file of req.files) {
      try {
        // Check for duplicates
        const duplicateCheck = folder_id 
          ? await db.promise().query("SELECT id FROM files WHERE file_name = ? AND folder_id = ?", [file.originalname, folder_id])
          : await db.promise().query("SELECT id FROM files WHERE file_name = ? AND folder_id IS NULL", [file.originalname]);
        
        if (duplicateCheck[0].length > 0) {
          errors.push({ fileName: file.originalname, error: "File already exists" });
          await unlinkAsync(file.path);
          continue;
        }
        
        // Insert file
        const [result] = await db.promise().query(
          `INSERT INTO files (folder_id, file_name, file_path, file_type, file_size, created_by, updated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            folder_id || null,
            file.originalname,
            file.path,
            path.extname(file.originalname).substring(1).toLowerCase(),
            file.size,
            created_by,
            created_by,
          ]
        );
        
        uploadedFiles.push({
          fileId: result.insertId,
          fileName: file.originalname,
          fileSize: file.size,
          fileSizeFormatted: formatFileSize(file.size),
          fileType: path.extname(file.originalname).substring(1).toLowerCase(),
        });
        
        await addActivityLog(created_by, "upload", "file", result.insertId, file.originalname);
        
      } catch (fileError) {
        console.error("💥 Error processing file:", file.originalname, fileError);
        errors.push({ fileName: file.originalname, error: fileError.message });
        if (fs.existsSync(file.path)) {
          await unlinkAsync(file.path);
        }
      }
    }
    
    res.json({
      message: `${uploadedFiles.length} files uploaded successfully`,
      uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
      totalUploaded: uploadedFiles.length,
      totalErrors: errors.length
    });
    
  } catch (err) {
    console.error("💥 Error in multiple upload:", err);
    
    // Clean up all uploaded files
    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          try {
            await unlinkAsync(file.path);
          } catch (cleanupError) {
            console.error("💥 Error cleaning up file:", cleanupError);
          }
        }
      }
    }
    
    res.status(500).json({ error: "Failed to upload files: " + err.message });
  }
});

// ================== Get Files (Root & Subfolders) ==================
router.get("/list", async (req, res) => {
  console.log("\n📂 ===== GET ROOT FILES/FOLDERS =====");
  
  try {
    console.log("🔍 Querying root files...");
    const [files] = await db.promise().query(
      `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name
       FROM files f
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users u2 ON f.updated_by = u2.id
       WHERE folder_id IS NULL
       ORDER BY f.file_name ASC`
    );
    
    console.log("🔍 Querying root folders...");
    const [folders] = await db.promise().query(
      `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name
       FROM folders f
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users u2 ON f.updated_by = u2.id
       WHERE parent_id IS NULL
       ORDER BY f.name ASC`
    );
    
    console.log("📊 Query results:");
    console.log("  - Files found:", files.length);
    console.log("  - Folders found:", folders.length);
    
    res.json({ 
      folders: folders || [], 
      files: files || [],
      location: "root"
    });
    
  } catch (err) {
    console.error("💥 Error getting root files/folders:", err);
    res.status(500).json({ error: "Failed to get files/folders: " + err.message });
  }
});

router.get("/list/:folderId", async (req, res) => {
  const { folderId } = req.params;
  
  console.log("\n📂 ===== GET FOLDER CONTENTS =====");
  console.log("📁 Folder ID:", folderId);
  
  try {
    // Validate folder exists
    console.log("🔍 Checking if folder exists...");
    const [folderCheck] = await db.promise().query("SELECT * FROM folders WHERE id = ?", [folderId]);
    if (folderCheck.length === 0) {
      console.log("❌ Folder not found:", folderId);
      return res.status(404).json({ error: "Folder not found" });
    }
    
    const folderInfo = folderCheck[0];
    console.log("✅ Folder found:", folderInfo.name);
    
    console.log("🔍 Querying files in folder...");
    const [files] = await db.promise().query(
      `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name
       FROM files f
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users u2 ON f.updated_by = u2.id
       WHERE folder_id = ?
       ORDER BY f.file_name ASC`,
      [folderId]
    );
    
    console.log("🔍 Querying subfolders...");
    const [folders] = await db.promise().query(
      `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name
       FROM folders f
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users u2 ON f.updated_by = u2.id
       WHERE parent_id = ?
       ORDER BY f.name ASC`,
      [folderId]
    );
    
    console.log("📊 Query results:");
    console.log("  - Files found:", files.length);
    console.log("  - Subfolders found:", folders.length);
    
    res.json({ 
      folders: folders || [], 
      files: files || [],
      currentFolder: folderInfo,
      location: folderInfo.name
    });
    
  } catch (err) {
    console.error("💥 Error getting folder contents:", err);
    res.status(500).json({ error: "Failed to get folder contents: " + err.message });
  }
});

// ================== Get Folder Path (Breadcrumb) ==================
router.get("/path/:folderId", async (req, res) => {
  const { folderId } = req.params;
  
  console.log("\n🧭 ===== GET FOLDER PATH =====");
  console.log("📁 Folder ID:", folderId);
  
  try {
    const path = [];
    let currentId = folderId;
    
    while (currentId) {
      const [folderResult] = await db.promise().query(
        "SELECT id, name, parent_id FROM folders WHERE id = ?",
        [currentId]
      );
      
      if (folderResult.length === 0) break;
      
      const folder = folderResult[0];
      path.unshift(folder); // Add to beginning of array
      currentId = folder.parent_id;
    }
    
    console.log("🧭 Folder path:", path);
    res.json({ path });
    
  } catch (err) {
    console.error("💥 Error getting folder path:", err);
    res.status(500).json({ error: "Failed to get folder path: " + err.message });
  }
});

// ================== Download File ==================
router.get("/download/:id", async (req, res) => {
  const { id } = req.params;
  
  console.log("\n⬇️ ===== DOWNLOAD FILE =====");
  console.log("📎 File ID:", id);
  
  try {
    console.log("🔍 Querying file details...");
    const [result] = await db.promise().query("SELECT * FROM files WHERE id = ?", [id]);
    
    if (result.length === 0) {
      console.log("❌ File not found in database:", id);
      return res.status(404).json({ error: "File not found" });
    }

    const file = result[0];
    console.log("📋 File details:", {
      id: file.id,
      name: file.file_name,
      path: file.file_path,
      size: file.file_size
    });
    
    // Validate file path
    if (!validateFilePath(file.file_path)) {
      console.log("❌ Invalid file path:", file.file_path);
      return res.status(400).json({ error: "Invalid file path" });
    }
    
    console.log("🔍 Checking if file exists on disk...");
    if (!fs.existsSync(file.file_path)) {
      console.log("❌ File missing on server:", file.file_path);
      return res.status(404).json({ error: "File missing on server" });
    }

    console.log("✅ File found, starting download...");
    
    // Log the download activity before starting download
    await addActivityLog(file.created_by, "download", "file", file.id, file.file_name);
    
    res.download(file.file_path, file.file_name, (err) => {
      if (err) {
        console.error("💥 Error during download:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Download failed" });
        }
      } else {
        console.log("✅ Download completed successfully");
      }
    });
    
  } catch (err) {
    console.error("💥 Error downloading file:", err);
    res.status(500).json({ error: "Download failed: " + err.message });
  }
});

// ================== Rename/Move File or Folder ==================
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { new_name, new_folder_id, updated_by } = req.body;
  
  console.log("\n✏️ ===== RENAME/MOVE REQUEST =====");
  console.log("🆔 Item ID:", id);
  console.log("📝 New name:", new_name);
  console.log("📁 New folder ID:", new_folder_id);
  console.log("👤 Updated by:", updated_by);
  
  try {
    // Validate updated_by user
    if (!updated_by) {
      return res.status(400).json({ error: "updated_by user ID is required" });
    }
    
    const userExists = await validateUser(updated_by);
    if (!userExists) {
      return res.status(400).json({ error: "Invalid updated_by user" });
    }
    
    // Check if it's a file
    const [fileResult] = await db.promise().query("SELECT * FROM files WHERE id = ?", [id]);
    
    if (fileResult.length > 0) {
      const file = fileResult[0];
      const sanitizedName = new_name ? sanitizeInput(new_name) : file.file_name;
      const targetFolderId = new_folder_id !== undefined ? new_folder_id : file.folder_id;
      
      // Validate new folder if provided
      if (targetFolderId) {
        const [folderCheck] = await db.promise().query("SELECT id FROM folders WHERE id = ?", [targetFolderId]);
        if (folderCheck.length === 0) {
          return res.status(400).json({ error: "Target folder not found" });
        }
      }
      
      // Check for duplicates in target location
      const duplicateCheck = targetFolderId 
        ? await db.promise().query("SELECT id FROM files WHERE file_name = ? AND folder_id = ? AND id != ?", [sanitizedName, targetFolderId, id])
        : await db.promise().query("SELECT id FROM files WHERE file_name = ? AND folder_id IS NULL AND id != ?", [sanitizedName, id]);
      
      if (duplicateCheck[0].length > 0) {
        return res.status(400).json({ error: "A file with this name already exists in the target location" });
      }
      
      // Update file
      await db.promise().query(
        "UPDATE files SET file_name = ?, folder_id = ?, updated_by = ?, updated_at = NOW() WHERE id = ?",
        [sanitizedName, targetFolderId, updated_by, id]
      );
      
      const action = new_name && new_folder_id !== undefined ? "move_rename" : (new_name ? "rename" : "move");
      await addActivityLog(updated_by, action, "file", id, sanitizedName);
      
      return res.json({
        message: "File updated successfully",
        updatedItem: {
          type: "file",
          id: file.id,
          oldName: file.file_name,
          newName: sanitizedName,
          oldFolderId: file.folder_id,
          newFolderId: targetFolderId
        }
      });
    }
    
    // Check if it's a folder
    const [folderResult] = await db.promise().query("SELECT * FROM folders WHERE id = ?", [id]);
    
    if (folderResult.length > 0) {
      const folder = folderResult[0];
      const sanitizedName = new_name ? sanitizeInput(new_name) : folder.name;
      const targetParentId = new_folder_id !== undefined ? new_folder_id : folder.parent_id;
      
      // Validate new parent folder if provided
      if (targetParentId) {
        const [parentCheck] = await db.promise().query("SELECT id FROM folders WHERE id = ?", [targetParentId]);
        if (parentCheck.length === 0) {
          return res.status(400).json({ error: "Target parent folder not found" });
        }
        
        // Check for circular reference (moving folder into itself or its descendant)
        const isCircular = await checkCircularReference(id, targetParentId);
        if (isCircular) {
          return res.status(400).json({ error: "Cannot move folder into itself or its descendant" });
        }
      }
      
      // Check for duplicates in target location
      const duplicateCheck = targetParentId 
        ? await db.promise().query("SELECT id FROM folders WHERE name = ? AND parent_id = ? AND id != ?", [sanitizedName, targetParentId, id])
        : await db.promise().query("SELECT id FROM folders WHERE name = ? AND parent_id IS NULL AND id != ?", [sanitizedName, id]);
      
      if (duplicateCheck[0].length > 0) {
        return res.status(400).json({ error: "A folder with this name already exists in the target location" });
      }
      
      // Update folder
      await db.promise().query(
        "UPDATE folders SET name = ?, parent_id = ?, updated_by = ?, updated_at = NOW() WHERE id = ?",
        [sanitizedName, targetParentId, updated_by, id]
      );
      
      const action = new_name && new_folder_id !== undefined ? "move_rename" : (new_name ? "rename" : "move");
      await addActivityLog(updated_by, action, "folder", id, sanitizedName);
      
      return res.json({
        message: "Folder updated successfully",
        updatedItem: {
          type: "folder",
          id: folder.id,
          oldName: folder.name,
          newName: sanitizedName,
          oldParentId: folder.parent_id,
          newParentId: targetParentId
        }
      });
    }
    
    return res.status(404).json({ error: "Item not found" });
    
  } catch (err) {
    console.error("💥 Error updating item:", err);
    res.status(500).json({ error: "Update failed: " + err.message });
  }
});

// ================== Helper: Check Circular Reference ==================
async function checkCircularReference(folderId, targetParentId) {
  let currentId = targetParentId;
  
  while (currentId) {
    if (currentId == folderId) {
      return true; // Circular reference found
    }
    
    const [result] = await db.promise().query("SELECT parent_id FROM folders WHERE id = ?", [currentId]);
    if (result.length === 0) break;
    
    currentId = result[0].parent_id;
  }
  
  return false;
}

// ================== Delete File/Folder ==================
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { updated_by, force } = req.body;
  
  console.log("\n🗑️ ===== DELETE REQUEST =====");
  console.log("🆔 Item ID:", id);
  console.log("👤 Updated by:", updated_by);
  console.log("💪 Force delete:", force);
  
  try {
    // Validate updated_by user
    if (!updated_by) {
      console.log("❌ Missing updated_by user ID");
      return res.status(400).json({ error: "updated_by user ID is required" });
    }
    
    console.log("🔍 Validating user...");
    const userExists = await validateUser(updated_by);
    if (!userExists) {
      console.log("❌ User validation failed for ID:", updated_by);
      return res.status(400).json({ error: "Invalid updated_by user" });
    }

    // --- Check if it's a file ---
    console.log("🔍 Checking if item is a file...");
    const [fileResult] = await db.promise().query("SELECT * FROM files WHERE id = ?", [id]);
    
    if (fileResult.length > 0) {
      console.log("📎 Found file to delete:", fileResult[0].file_name);
      const file = fileResult[0];
      
      // Delete physical file
      if (file.file_path && fs.existsSync(file.file_path)) {
        console.log("🗑️ Deleting physical file:", file.file_path);
        await unlinkAsync(file.file_path);
        console.log("✅ Physical file deleted");
      } else {
        console.log("⚠️ Physical file not found on disk:", file.file_path);
      }
      
      // Delete database record
      console.log("🗑️ Deleting file from database...");
      await db.promise().query("DELETE FROM files WHERE id = ?", [id]);
      console.log("✅ File deleted from database");
      
      await addActivityLog(updated_by, "delete", "file", file.id, file.file_name);
      
      return res.json({ 
        message: "File deleted successfully",
        deletedItem: {
          type: "file",
          id: file.id,
          name: file.file_name
        }
      });
    }

    // --- Check if it's a folder ---
    console.log("🔍 Checking if item is a folder...");
    const [folderResult] = await db.promise().query("SELECT * FROM folders WHERE id = ?", [id]);
    
    if (folderResult.length > 0) {
      console.log("📁 Found folder to delete:", folderResult[0].name);
      const folder = folderResult[0];
      
      if (force) {
        // Force delete: recursively delete all contents
        console.log("💪 Force deleting folder with all contents...");
        const deletedItems = await recursivelyDeleteFolder(id, updated_by);
        
        return res.json({
          message: "Folder and all contents deleted successfully",
          deletedItem: {
            type: "folder",
            id: folder.id,
            name: folder.name
          },
          deletedContents: deletedItems
        });
      } else {
        // Regular delete: check if folder is empty
        const [containedFiles] = await db.promise().query("SELECT id, file_name FROM files WHERE folder_id = ?", [id]);
        const [containedFolders] = await db.promise().query("SELECT id, name FROM folders WHERE parent_id = ?", [id]);

        console.log("📊 Folder contents:");
        console.log("  - Files:", containedFiles.length);
        console.log("  - Subfolders:", containedFolders.length);

        if (containedFiles.length > 0 || containedFolders.length > 0) {
          console.log("❌ Cannot delete non-empty folder");
          return res.status(400).json({ 
            error: "Cannot delete non-empty folder. Use force=true to delete with contents, or delete contents first.",
            containedFiles: containedFiles.map(f => f.file_name),
            containedFolders: containedFolders.map(f => f.name)
          });
        }

        console.log("🗑️ Deleting empty folder from database...");
        await db.promise().query("DELETE FROM folders WHERE id = ?", [id]);
        console.log("✅ Folder deleted from database");
        
        await addActivityLog(updated_by, "delete", "folder", folder.id, folder.name);
        
        return res.json({ 
          message: "Folder deleted successfully",
          deletedItem: {
            type: "folder",
            id: folder.id,
            name: folder.name
          }
        });
      }
    }

    console.log("❌ Item not found (neither file nor folder)");
    return res.status(404).json({ error: "Item not found" });
    
  } catch (err) {
    console.error("💥 Error during deletion:", err);
    console.error("📋 Error stack:", err.stack);
    res.status(500).json({ error: "Delete failed: " + err.message });
  }
});

// ================== Helper: Recursively Delete Folder ==================
async function recursivelyDeleteFolder(folderId, deletedBy) {
  const deletedItems = { files: [], folders: [] };
  
  try {
    // Get all files in this folder
    const [files] = await db.promise().query("SELECT * FROM files WHERE folder_id = ?", [folderId]);
    
    // Delete all files
    for (const file of files) {
      // Delete physical file
      if (file.file_path && fs.existsSync(file.file_path)) {
        await unlinkAsync(file.file_path);
      }
      
      // Delete from database
      await db.promise().query("DELETE FROM files WHERE id = ?", [file.id]);
      
      deletedItems.files.push({ id: file.id, name: file.file_name });
      await addActivityLog(deletedBy, "delete", "file", file.id, file.file_name, "force_delete_folder");
    }
    
    // Get all subfolders
    const [subfolders] = await db.promise().query("SELECT * FROM folders WHERE parent_id = ?", [folderId]);
    
    // Recursively delete subfolders
    for (const subfolder of subfolders) {
      const subfolderDeleted = await recursivelyDeleteFolder(subfolder.id, deletedBy);
      deletedItems.files.push(...subfolderDeleted.files);
      deletedItems.folders.push(...subfolderDeleted.folders);
      deletedItems.folders.push({ id: subfolder.id, name: subfolder.name });
    }
    
    // Delete the folder itself
    await db.promise().query("DELETE FROM folders WHERE id = ?", [folderId]);
    
    const [folderInfo] = await db.promise().query("SELECT name FROM folders WHERE id = ?", [folderId]);
    const folderName = folderInfo.length > 0 ? folderInfo[0].name : `Folder ${folderId}`;
    await addActivityLog(deletedBy, "delete", "folder", folderId, folderName, "force_delete");
    
  } catch (error) {
    console.error("💥 Error in recursive delete:", error);
    throw error;
  }
  
  return deletedItems;
}

// ================== Bulk Delete ==================
router.delete("/bulk/delete", async (req, res) => {
  const { ids, updated_by, force } = req.body;
  
  console.log("\n🗑️ ===== BULK DELETE REQUEST =====");
  console.log("🆔 Item IDs:", ids);
  console.log("👤 Updated by:", updated_by);
  console.log("💪 Force delete:", force);
  
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs array is required" });
    }
    
    if (!updated_by) {
      return res.status(400).json({ error: "updated_by user ID is required" });
    }
    
    const userExists = await validateUser(updated_by);
    if (!userExists) {
      return res.status(400).json({ error: "Invalid updated_by user" });
    }
    
    const results = { deleted: [], errors: [] };
    
    for (const id of ids) {
      try {
        // Try to delete as file first
        const [fileResult] = await db.promise().query("SELECT * FROM files WHERE id = ?", [id]);
        
        if (fileResult.length > 0) {
          const file = fileResult[0];
          
          // Delete physical file
          if (file.file_path && fs.existsSync(file.file_path)) {
            await unlinkAsync(file.file_path);
          }
          
          await db.promise().query("DELETE FROM files WHERE id = ?", [id]);
          await addActivityLog(updated_by, "delete", "file", file.id, file.file_name, "bulk_delete");
          
          results.deleted.push({ type: "file", id: file.id, name: file.file_name });
          continue;
        }
        
        // Try to delete as folder
        const [folderResult] = await db.promise().query("SELECT * FROM folders WHERE id = ?", [id]);
        
        if (folderResult.length > 0) {
          const folder = folderResult[0];
          
          if (force) {
            // Force delete folder with contents
            await recursivelyDeleteFolder(id, updated_by);
            results.deleted.push({ type: "folder", id: folder.id, name: folder.name, forceDeleted: true });
          } else {
            // Check if folder is empty
            const [containedFiles] = await db.promise().query("SELECT COUNT(*) as count FROM files WHERE folder_id = ?", [id]);
            const [containedFolders] = await db.promise().query("SELECT COUNT(*) as count FROM folders WHERE parent_id = ?", [id]);
            
            if (containedFiles[0].count > 0 || containedFolders[0].count > 0) {
              results.errors.push({ 
                id, 
                name: folder.name, 
                error: "Folder not empty. Use force=true to delete with contents." 
              });
              continue;
            }
            
            await db.promise().query("DELETE FROM folders WHERE id = ?", [id]);
            await addActivityLog(updated_by, "delete", "folder", folder.id, folder.name, "bulk_delete");
            
            results.deleted.push({ type: "folder", id: folder.id, name: folder.name });
          }
          continue;
        }
        
        results.errors.push({ id, error: "Item not found" });
        
      } catch (itemError) {
        console.error(`💥 Error deleting item ${id}:`, itemError);
        results.errors.push({ id, error: itemError.message });
      }
    }
    
    res.json({
      message: `Bulk delete completed. ${results.deleted.length} items deleted, ${results.errors.length} errors.`,
      results
    });
    
  } catch (err) {
    console.error("💥 Error in bulk delete:", err);
    res.status(500).json({ error: "Bulk delete failed: " + err.message });
  }
});

// ================== Search Files/Folders ==================
router.get("/search", async (req, res) => {
  const { q: query, type, created_after, created_before, min_size, max_size, created_by } = req.query;
  
  console.log("\n🔍 ===== SEARCH REQUEST =====");
  console.log("🔎 Query:", query);
  console.log("📂 Type filter:", type);
  console.log("📅 Date filters:", { created_after, created_before });
  console.log("📏 Size filters:", { min_size, max_size });
  console.log("👤 Creator filter:", created_by);
  
  try {
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: "Search query is required" });
    }
    
    const searchTerm = `%${query.trim()}%`;
    let results = { files: [], folders: [] };
    
    // Search files
    if (!type || type === 'file') {
      console.log("🔍 Searching files...");
      
      let sql = `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name,
                        fo.name AS folder_name
                 FROM files f
                 LEFT JOIN users u ON f.created_by = u.id
                 LEFT JOIN users u2 ON f.updated_by = u2.id
                 LEFT JOIN folders fo ON f.folder_id = fo.id
                 WHERE f.file_name LIKE ?`;
      
      const params = [searchTerm];
      
      if (created_after) {
        sql += " AND f.created_at >= ?";
        params.push(created_after);
      }
      
      if (created_before) {
        sql += " AND f.created_at <= ?";
        params.push(created_before);
      }
      
      if (min_size) {
        sql += " AND f.file_size >= ?";
        params.push(parseInt(min_size));
      }
      
      if (max_size) {
        sql += " AND f.file_size <= ?";
        params.push(parseInt(max_size));
      }
      
      if (created_by) {
        sql += " AND f.created_by = ?";
        params.push(created_by);
      }
      
      sql += " ORDER BY f.file_name ASC LIMIT 100";
      
      const [files] = await db.promise().query(sql, params);
      results.files = files;
      console.log("📎 Files found:", files.length);
    }
    
    // Search folders
    if (!type || type === 'folder') {
      console.log("🔍 Searching folders...");
      
      let sql = `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name,
                        pf.name AS parent_folder_name
                 FROM folders f
                 LEFT JOIN users u ON f.created_by = u.id
                 LEFT JOIN users u2 ON f.updated_by = u2.id
                 LEFT JOIN folders pf ON f.parent_id = pf.id
                 WHERE f.name LIKE ?`;
      
      const params = [searchTerm];
      
      if (created_after) {
        sql += " AND f.created_at >= ?";
        params.push(created_after);
      }
      
      if (created_before) {
        sql += " AND f.created_at <= ?";
        params.push(created_before);
      }
      
      if (created_by) {
        sql += " AND f.created_by = ?";
        params.push(created_by);
      }
      
      sql += " ORDER BY f.name ASC LIMIT 100";
      
      const [folders] = await db.promise().query(sql, params);
      results.folders = folders;
      console.log("📁 Folders found:", folders.length);
    }
    
    console.log("✅ Search completed");
    res.json({
      query: query.trim(),
      filters: { type, created_after, created_before, min_size, max_size, created_by },
      results: results,
      totalResults: results.files.length + results.folders.length
    });
    
  } catch (err) {
    console.error("💥 Error during search:", err);
    res.status(500).json({ error: "Search failed: " + err.message });
  }
});

// ================== Get Statistics ==================
router.get("/stats", async (req, res) => {
  console.log("\n📊 ===== GET STATISTICS =====");
  
  try {
    // Get total counts
    const [fileCount] = await db.promise().query("SELECT COUNT(*) as count FROM files");
    const [folderCount] = await db.promise().query("SELECT COUNT(*) as count FROM folders");
    
    // Get total file size
    const [sizeResult] = await db.promise().query("SELECT SUM(file_size) as total_size FROM files");
    const totalSize = sizeResult[0].total_size || 0;
    
    // Get file type distribution
    const [fileTypes] = await db.promise().query(`
      SELECT file_type, COUNT(*) as count, SUM(file_size) as total_size
      FROM files 
      WHERE file_type IS NOT NULL AND file_type != ''
      GROUP BY file_type 
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Get recent activity
    const [recentActivity] = await db.promise().query(`
      SELECT COUNT(*) as count, action
      FROM activity_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY action
      ORDER BY count DESC
    `);
    
    // Get top users by file count
    const [topUsers] = await db.promise().query(`
      SELECT u.name, COUNT(*) as file_count, SUM(f.file_size) as total_size
      FROM files f
      JOIN users u ON f.created_by = u.id
      GROUP BY f.created_by, u.name
      ORDER BY file_count DESC
      LIMIT 5
    `);
    
    const stats = {
      totalFiles: fileCount[0].count,
      totalFolders: folderCount[0].count,
      totalSize: totalSize,
      totalSizeFormatted: formatFileSize(totalSize),
      fileTypes: fileTypes,
      recentActivity: recentActivity,
      topUsers: topUsers,
      averageFileSize: fileCount[0].count > 0 ? Math.round(totalSize / fileCount[0].count) : 0,
      averageFileSizeFormatted: fileCount[0].count > 0 ? formatFileSize(Math.round(totalSize / fileCount[0].count)) : '0 Bytes'
    };
    
    console.log("📊 Statistics:", stats);
    res.json(stats);
    
  } catch (err) {
    console.error("💥 Error getting statistics:", err);
    res.status(500).json({ error: "Failed to get statistics: " + err.message });
  }
});

// ================== Get Activity Logs ==================
router.get("/activity-logs", async (req, res) => {
  const { user_id, action, target_type, limit = 100, offset = 0 } = req.query;

  let sql = `SELECT al.*, u.name AS user_name
             FROM activity_logs al
             JOIN users u ON al.user_id = u.id
             WHERE 1=1`;
  const params = [];

  if (user_id) {
    sql += " AND al.user_id = ?";
    params.push(user_id);
  }
  if (action) {
    sql += " AND al.action = ?";
    params.push(action);
  }
  if (target_type) {
    sql += " AND al.target_type = ?";
    params.push(target_type);
  }

  sql += " ORDER BY al.created_at DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));

  try {
    const [rows] = await db.promise().query(sql, params);
    
    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as total FROM activity_logs al WHERE 1=1`;
    const countParams = [];
    
    if (user_id) {
      countSql += " AND al.user_id = ?";
      countParams.push(user_id);
    }
    if (action) {
      countSql += " AND al.action = ?";
      countParams.push(action);
    }
    if (target_type) {
      countSql += " AND al.target_type = ?";
      countParams.push(target_type);
    }
    
    const [countResult] = await db.promise().query(countSql, countParams);
    
    res.json({
      logs: rows,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: countResult[0].total > (parseInt(offset) + parseInt(limit))
      }
    });
  } catch (err) {
    console.error("Error fetching activity logs:", err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// ================== Copy Files/Folders ==================
router.post("/copy", async (req, res) => {
  const { source_ids, target_folder_id, created_by } = req.body;
  
  console.log("\n📋 ===== COPY REQUEST =====");
  console.log("🆔 Source IDs:", source_ids);
  console.log("📁 Target folder ID:", target_folder_id);
  console.log("👤 Created by:", created_by);
  
  try {
    if (!Array.isArray(source_ids) || source_ids.length === 0) {
      return res.status(400).json({ error: "source_ids array is required" });
    }
    
    if (!created_by) {
      return res.status(400).json({ error: "created_by user ID is required" });
    }
    
    const userExists = await validateUser(created_by);
    if (!userExists) {
      return res.status(400).json({ error: "Invalid created_by user" });
    }
    
    // Validate target folder if provided
    if (target_folder_id) {
      const [folderCheck] = await db.promise().query("SELECT id FROM folders WHERE id = ?", [target_folder_id]);
      if (folderCheck.length === 0) {
        return res.status(400).json({ error: "Target folder not found" });
      }
    }
    
    const results = { copied: [], errors: [] };
    
    for (const sourceId of source_ids) {
      try {
        // Try to copy file
        const [fileResult] = await db.promise().query("SELECT * FROM files WHERE id = ?", [sourceId]);
        
        if (fileResult.length > 0) {
          const originalFile = fileResult[0];
          let copyName = originalFile.file_name;
          let counter = 1;
          
          // Find unique name
          while (true) {
            const duplicateCheck = target_folder_id 
              ? await db.promise().query("SELECT id FROM files WHERE file_name = ? AND folder_id = ?", [copyName, target_folder_id])
              : await db.promise().query("SELECT id FROM files WHERE file_name = ? AND folder_id IS NULL", [copyName]);
            
            if (duplicateCheck[0].length === 0) break;
            
            const nameWithoutExt = path.parse(originalFile.file_name).name;
            const ext = path.parse(originalFile.file_name).ext;
            copyName = `${nameWithoutExt} (Copy ${counter})${ext}`;
            counter++;
          }
          
          // Copy physical file
          const newFilePath = path.join(path.dirname(originalFile.file_path), Date.now() + "-" + copyName.replace(/[^a-zA-Z0-9.-]/g, '_'));
          await fs.promises.copyFile(originalFile.file_path, newFilePath);
          
          // Insert copy into database
          const [result] = await db.promise().query(
            `INSERT INTO files (folder_id, file_name, file_path, file_type, file_size, created_by, updated_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              target_folder_id || null,
              copyName,
              newFilePath,
              originalFile.file_type,
              originalFile.file_size,
              created_by,
              created_by,
            ]
          );
          
          await addActivityLog(created_by, "copy", "file", result.insertId, copyName, JSON.stringify({ source_id: sourceId }));
          
          results.copied.push({
            type: "file",
            originalId: sourceId,
            newId: result.insertId,
            originalName: originalFile.file_name,
            newName: copyName
          });
          
          continue;
        }
        
        // Try to copy folder (simplified - doesn't copy contents)
        const [folderResult] = await db.promise().query("SELECT * FROM folders WHERE id = ?", [sourceId]);
        
        if (folderResult.length > 0) {
          const originalFolder = folderResult[0];
          let copyName = originalFolder.name;
          let counter = 1;
          
          // Find unique name
          while (true) {
            const duplicateCheck = target_folder_id 
              ? await db.promise().query("SELECT id FROM folders WHERE name = ? AND parent_id = ?", [copyName, target_folder_id])
              : await db.promise().query("SELECT id FROM folders WHERE name = ? AND parent_id IS NULL", [copyName]);
            
            if (duplicateCheck[0].length === 0) break;
            
            copyName = `${originalFolder.name} (Copy ${counter})`;
            counter++;
          }
          
          const [result] = await db.promise().query(
            `INSERT INTO folders (name, parent_id, created_by, updated_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, NOW(), NOW())`,
            [copyName, target_folder_id || null, created_by, created_by]
          );
          
          await addActivityLog(created_by, "copy", "folder", result.insertId, copyName, JSON.stringify({ source_id: sourceId }));
          
          results.copied.push({
            type: "folder",
            originalId: sourceId,
            newId: result.insertId,
            originalName: originalFolder.name,
            newName: copyName
          });
          
          continue;
        }
        
        results.errors.push({ id: sourceId, error: "Item not found" });
        
      } catch (itemError) {
        console.error(`💥 Error copying item ${sourceId}:`, itemError);
        results.errors.push({ id: sourceId, error: itemError.message });
      }
    }
    
    res.json({
      message: `Copy completed. ${results.copied.length} items copied, ${results.errors.length} errors.`,
      results
    });
    
  } catch (err) {
    console.error("💥 Error in copy operation:", err);
    res.status(500).json({ error: "Copy failed: " + err.message });
  }
});

// ================== Error Handler ==================
router.use((error, req, res, next) => {
  console.error("💥 Unhandled error in files router:", error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.` });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: "Unexpected file field." });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: `Too many files. Maximum is ${MAX_FILES_PER_REQUEST} files per request.` });
    }
  }
  
  res.status(500).json({ error: "Internal server error: " + error.message });
});

// ================== Get File/Folder Info ==================
router.get("/info/:id", async (req, res) => {
  const { id } = req.params;
  
  console.log("\n📋 ===== GET ITEM INFO =====");
  console.log("🆔 Item ID:", id);
  
  try {
    // Check if it's a file
    const [fileResult] = await db.promise().query(
      `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name,
              fo.name AS folder_name, fo.id AS folder_id
       FROM files f
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users u2 ON f.updated_by = u2.id
       LEFT JOIN folders fo ON f.folder_id = fo.id
       WHERE f.id = ?`,
      [id]
    );
    
    if (fileResult.length > 0) {
      const file = fileResult[0];
      
      // Get file stats if file exists on disk
      let fileStats = null;
      if (fs.existsSync(file.file_path)) {
        const stats = await fs.promises.stat(file.file_path);
        fileStats = {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          accessed: stats.atime
        };
      }
      
      return res.json({
        type: "file",
        id: file.id,
        name: file.file_name,
        path: file.file_path,
        size: file.file_size,
        sizeFormatted: formatFileSize(file.file_size),
        fileType: file.file_type,
        folder: file.folder_id ? {
          id: file.folder_id,
          name: file.folder_name
        } : null,
        createdBy: {
          id: file.created_by,
          name: file.created_by_name
        },
        updatedBy: {
          id: file.updated_by,
          name: file.updated_by_name
        },
        createdAt: file.created_at,
        updatedAt: file.updated_at,
        fileStats: fileStats,
        exists: fs.existsSync(file.file_path)
      });
    }
    
    // Check if it's a folder
    const [folderResult] = await db.promise().query(
      `SELECT f.*, u.name AS created_by_name, u2.name AS updated_by_name,
              pf.name AS parent_folder_name, pf.id AS parent_folder_id
       FROM folders f
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN users u2 ON f.updated_by = u2.id
       LEFT JOIN folders pf ON f.parent_id = pf.id
       WHERE f.id = ?`,
      [id]
    );
    
    if (folderResult.length > 0) {
      const folder = folderResult[0];
      
      // Get folder statistics
      const [fileCount] = await db.promise().query("SELECT COUNT(*) as count FROM files WHERE folder_id = ?", [id]);
      const [subfolderCount] = await db.promise().query("SELECT COUNT(*) as count FROM folders WHERE parent_id = ?", [id]);
      const [totalSize] = await db.promise().query("SELECT SUM(file_size) as total FROM files WHERE folder_id = ?", [id]);
      
      return res.json({
        type: "folder",
        id: folder.id,
        name: folder.name,
        parentFolder: folder.parent_folder_id ? {
          id: folder.parent_folder_id,
          name: folder.parent_folder_name
        } : null,
        createdBy: {
          id: folder.created_by,
          name: folder.created_by_name
        },
        updatedBy: {
          id: folder.updated_by,
          name: folder.updated_by_name
        },
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
        statistics: {
          fileCount: fileCount[0].count,
          subfolderCount: subfolderCount[0].count,
          totalSize: totalSize[0].total || 0,
          totalSizeFormatted: formatFileSize(totalSize[0].total || 0)
        }
      });
    }
    
    return res.status(404).json({ error: "Item not found" });
    
  } catch (err) {
    console.error("💥 Error getting item info:", err);
    res.status(500).json({ error: "Failed to get item info: " + err.message });
  }
});

// ================== Create Multiple Folders ==================
router.post("/folders/bulk", async (req, res) => {
  const { folders, created_by } = req.body;
  
  console.log("\n📁 ===== BULK CREATE FOLDERS =====");
  console.log("📥 Folders to create:", folders);
  console.log("👤 Created by:", created_by);
  
  try {
    if (!Array.isArray(folders) || folders.length === 0) {
      return res.status(400).json({ error: "folders array is required" });
    }
    
    if (!created_by) {
      return res.status(400).json({ error: "created_by user ID is required" });
    }
    
    const userExists = await validateUser(created_by);
    if (!userExists) {
      return res.status(400).json({ error: "Invalid created_by user" });
    }
    
    const results = { created: [], errors: [] };
    
    for (const folderData of folders) {
      try {
        const { name, parent_id } = folderData;
        
        if (!name || name.trim() === '') {
          results.errors.push({ folderData, error: "Folder name is required" });
          continue;
        }
        
        const sanitizedName = sanitizeInput(name);
        
        // Validate parent folder if provided
        if (parent_id) {
          const [parentCheck] = await db.promise().query("SELECT id FROM folders WHERE id = ?", [parent_id]);
          if (parentCheck.length === 0) {
            results.errors.push({ folderData, error: "Parent folder not found" });
            continue;
          }
        }
        
        // Check for duplicates
        const duplicateCheck = parent_id 
          ? await db.promise().query("SELECT id FROM folders WHERE name = ? AND parent_id = ?", [sanitizedName, parent_id])
          : await db.promise().query("SELECT id FROM folders WHERE name = ? AND parent_id IS NULL", [sanitizedName]);
        
        if (duplicateCheck[0].length > 0) {
          results.errors.push({ folderData, error: "A folder with this name already exists in the same location" });
          continue;
        }
        
        // Create folder
        const [result] = await db.promise().query(
          `INSERT INTO folders (name, parent_id, created_by, updated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [sanitizedName, parent_id || null, created_by, created_by]
        );
        
        await addActivityLog(created_by, "create", "folder", result.insertId, sanitizedName, "bulk_create");
        
        results.created.push({
          id: result.insertId,
          name: sanitizedName,
          parent_id: parent_id || null
        });
        
      } catch (folderError) {
        console.error("💥 Error creating folder:", folderError);
        results.errors.push({ folderData, error: folderError.message });
      }
    }
    
    res.json({
      message: `Bulk folder creation completed. ${results.created.length} folders created, ${results.errors.length} errors.`,
      results
    });
    
  } catch (err) {
    console.error("💥 Error in bulk folder creation:", err);
    res.status(500).json({ error: "Bulk folder creation failed: " + err.message });
  }
});

// ================== Get Recent Files ==================
router.get("/recent", async (req, res) => {
  const { limit = 20, user_id } = req.query;
  
  console.log("\n🕒 ===== GET RECENT FILES =====");
  console.log("📊 Limit:", limit);
  console.log("👤 User filter:", user_id);
  
  try {
    let sql = `SELECT f.*, u.name AS created_by_name, fo.name AS folder_name
               FROM files f
               LEFT JOIN users u ON f.created_by = u.id
               LEFT JOIN folders fo ON f.folder_id = fo.id
               WHERE 1=1`;
    
    const params = [];
    
    if (user_id) {
      sql += " AND f.created_by = ?";
      params.push(user_id);
    }
    
    sql += " ORDER BY f.created_at DESC LIMIT ?";
    params.push(parseInt(limit));
    
    const [files] = await db.promise().query(sql, params);
    
    res.json({
      files: files,
      count: files.length,
      limit: parseInt(limit)
    });
    
  } catch (err) {
    console.error("💥 Error getting recent files:", err);
    res.status(500).json({ error: "Failed to get recent files: " + err.message });
  }
});

// ================== Check Disk Space ==================
router.get("/disk-usage", async (req, res) => {
  console.log("\n💾 ===== CHECK DISK USAGE =====");
  
  try {
    // Get total size from database
    const [dbSize] = await db.promise().query("SELECT SUM(file_size) as total FROM files");
    const totalDbSize = dbSize[0].total || 0;
    
    // Calculate actual disk usage by checking upload directory
    let actualDiskUsage = 0;
    const uploadDir = path.join(__dirname, '../uploads');
    
    if (fs.existsSync(uploadDir)) {
      const calculateDirSize = async (dirPath) => {
        let size = 0;
        const files = await fs.promises.readdir(dirPath);
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = await fs.promises.stat(filePath);
          
          if (stats.isDirectory()) {
            size += await calculateDirSize(filePath);
          } else {
            size += stats.size;
          }
        }
        
        return size;
      };
      
      actualDiskUsage = await calculateDirSize(uploadDir);
    }
    
    // Get file count by type
    const [fileTypes] = await db.promise().query(`
      SELECT file_type, COUNT(*) as count, SUM(file_size) as size
      FROM files 
      WHERE file_type IS NOT NULL AND file_type != ''
      GROUP BY file_type
      ORDER BY size DESC
    `);
    
    res.json({
      databaseSize: totalDbSize,
      databaseSizeFormatted: formatFileSize(totalDbSize),
      actualDiskUsage: actualDiskUsage,
      actualDiskUsageFormatted: formatFileSize(actualDiskUsage),
      difference: Math.abs(actualDiskUsage - totalDbSize),
      differenceFormatted: formatFileSize(Math.abs(actualDiskUsage - totalDbSize)),
      isConsistent: Math.abs(actualDiskUsage - totalDbSize) < (1024 * 1024), // Within 1MB difference
      fileTypeBreakdown: fileTypes
    });
    
  } catch (err) {
    console.error("💥 Error checking disk usage:", err);
    res.status(500).json({ error: "Failed to check disk usage: " + err.message });
  }
});

// ================== Cleanup Orphaned Files ==================
router.post("/cleanup", async (req, res) => {
  const { dry_run = true, updated_by } = req.body;
  
  console.log("\n🧹 ===== CLEANUP ORPHANED FILES =====");
  console.log("🔍 Dry run:", dry_run);
  console.log("👤 Updated by:", updated_by);
  
  try {
    if (!updated_by) {
      return res.status(400).json({ error: "updated_by user ID is required" });
    }
    
    const userExists = await validateUser(updated_by);
    if (!userExists) {
      return res.status(400).json({ error: "Invalid updated_by user" });
    }
    
    // Find database records without physical files
    const [dbFiles] = await db.promise().query("SELECT id, file_name, file_path FROM files");
    const missingFiles = [];
    
    for (const file of dbFiles) {
      if (!fs.existsSync(file.file_path)) {
        missingFiles.push(file);
      }
    }
    
    // Find physical files without database records
    const uploadDir = path.join(__dirname, '../uploads');
    const orphanedFiles = [];
    
    if (fs.existsSync(uploadDir)) {
      const scanDirectory = async (dirPath) => {
        const files = await fs.promises.readdir(dirPath);
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = await fs.promises.stat(filePath);
          
          if (stats.isFile()) {
            const [dbCheck] = await db.promise().query("SELECT id FROM files WHERE file_path = ?", [filePath]);
            if (dbCheck.length === 0) {
              orphanedFiles.push({
                path: filePath,
                name: file,
                size: stats.size,
                modified: stats.mtime
              });
            }
          } else if (stats.isDirectory()) {
            await scanDirectory(filePath);
          }
        }
      };
      
      await scanDirectory(uploadDir);
    }
    
    if (!dry_run) {
      // Clean up database records for missing files
      for (const missingFile of missingFiles) {
        await db.promise().query("DELETE FROM files WHERE id = ?", [missingFile.id]);
        await addActivityLog(updated_by, "cleanup_delete", "file", missingFile.id, missingFile.file_name, "missing_physical_file");
      }
      
      // Clean up orphaned physical files
      for (const orphanedFile of orphanedFiles) {
        await fs.promises.unlink(orphanedFile.path);
        await addActivityLog(updated_by, "cleanup_delete", "file", null, orphanedFile.name, "orphaned_physical_file");
      }
    }
    
    res.json({
      message: dry_run ? "Cleanup analysis completed" : "Cleanup completed",
      dryRun: dry_run,
      missingFiles: {
        count: missingFiles.length,
        files: missingFiles.map(f => ({ id: f.id, name: f.file_name, path: f.file_path }))
      },
      orphanedFiles: {
        count: orphanedFiles.length,
        totalSize: orphanedFiles.reduce((sum, f) => sum + f.size, 0),
        totalSizeFormatted: formatFileSize(orphanedFiles.reduce((sum, f) => sum + f.size, 0)),
        files: orphanedFiles
      },
      summary: {
        totalIssues: missingFiles.length + orphanedFiles.length,
        cleaned: !dry_run
      }
    });
    
  } catch (err) {
    console.error("💥 Error during cleanup:", err);
    res.status(500).json({ error: "Cleanup failed: " + err.message });
  }
});

console.log("📁 Enhanced Files router loaded with comprehensive features");

module.exports = router;