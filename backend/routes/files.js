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

module.exports = router;
