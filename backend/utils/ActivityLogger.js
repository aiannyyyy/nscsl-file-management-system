const db = require("../db"); // Adjust path as needed

class ActivityLogger {
  /**
   * Log an activity to the database
   * @param {number} userId - User ID who performed the action
   * @param {string} activityType - Type of activity (create_folder, upload_file, etc.)
   * @param {string} targetType - Type of target (file or folder)
   * @param {number} targetId - ID of the target file/folder
   * @param {string} targetName - Name of the target
   * @param {string} targetPath - Path of the target (optional)
   * @param {number} fileSize - Size of file (for file operations, optional)
   * @param {string} oldValue - Old value for rename/move operations (optional)
   * @param {string} newValue - New value for rename/move operations (optional)
   * @param {object} req - Express request object for IP/User Agent (optional)
   */
  static async logActivity(userId, activityType, targetType, targetId, targetName, targetPath = null, fileSize = null, oldValue = null, newValue = null, req = null) {
    try {
      const ipAddress = req ? (req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null) : null;
      const userAgent = req ? req.get('User-Agent') : null;
      
      const query = `
        INSERT INTO activity_logs 
        (user_id, activity_type, target_type, target_id, target_name, target_path, file_size, old_value, new_value, ip_address, user_agent) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const [result] = await db.promise().query(query, [
        userId,
        activityType,
        targetType,
        targetId,
        targetName,
        targetPath,
        fileSize,
        oldValue,
        newValue,
        ipAddress,
        userAgent
      ]);
      
      console.log(`📝 Activity logged: ${activityType} - ${targetName} (ID: ${result.insertId})`);
      return result.insertId;
      
    } catch (error) {
      console.error("💥 Error logging activity:", error);
      // Don't throw error - logging failure shouldn't break the main operation
      return null;
    }
  }
  
  // Convenience methods for specific activities
  static async logFileUpload(userId, fileId, fileName, filePath, fileSize, req = null) {
    return await this.logActivity(userId, 'upload_file', 'file', fileId, fileName, filePath, fileSize, null, null, req);
  }
  
  static async logFileDelete(userId, fileId, fileName, filePath, fileSize, req = null) {
    return await this.logActivity(userId, 'delete_file', 'file', fileId, fileName, filePath, fileSize, null, null, req);
  }
  
  static async logFolderCreate(userId, folderId, folderName, req = null) {
    return await this.logActivity(userId, 'create_folder', 'folder', folderId, folderName, null, null, null, null, req);
  }
  
  static async logFolderDelete(userId, folderId, folderName, req = null) {
    return await this.logActivity(userId, 'delete_folder', 'folder', folderId, folderName, null, null, null, null, req);
  }
  
  static async logFileRename(userId, fileId, oldName, newName, filePath, req = null) {
    return await this.logActivity(userId, 'rename_file', 'file', fileId, newName, filePath, null, oldName, newName, req);
  }
  
  static async logFolderRename(userId, folderId, oldName, newName, req = null) {
    return await this.logActivity(userId, 'rename_folder', 'folder', folderId, newName, null, null, oldName, newName, req);
  }
  
  static async logFileMove(userId, fileId, fileName, oldPath, newPath, req = null) {
    return await this.logActivity(userId, 'move_file', 'file', fileId, fileName, newPath, null, oldPath, newPath, req);
  }
  
  static async logFolderMove(userId, folderId, folderName, oldPath, newPath, req = null) {
    return await this.logActivity(userId, 'move_folder', 'folder', folderId, folderName, newPath, null, oldPath, newPath, req);
  }
  
  /**
   * Get recent activities for dashboard
   * @param {number} limit - Number of activities to fetch
   * @param {number} userId - Filter by specific user (optional)
   * @param {string} activityType - Filter by activity type (optional)
   */
  static async getRecentActivities(limit = 50, userId = null, activityType = null) {
    try {
      let query = `
        SELECT 
          al.*,
          u.name as user_name,
          u.user_name as username
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;
      
      const params = [];
      
      if (userId) {
        query += " AND al.user_id = ?";
        params.push(userId);
      }
      
      if (activityType) {
        query += " AND al.activity_type = ?";
        params.push(activityType);
      }
      
      query += " ORDER BY al.created_at DESC LIMIT ?";
      params.push(limit);
      
      const [activities] = await db.promise().query(query, params);
      return activities;
      
    } catch (error) {
      console.error("💥 Error fetching activities:", error);
      return [];
    }
  }
  
  /**
   * Get activity statistics for dashboard
   */
  static async getActivityStats(days = 30) {
    try {
      const query = `
        SELECT 
          activity_type,
          COUNT(*) as count,
          DATE(created_at) as activity_date
        FROM activity_logs 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY activity_type, DATE(created_at)
        ORDER BY activity_date DESC, count DESC
      `;
      
      const [stats] = await db.promise().query(query, [days]);
      return stats;
      
    } catch (error) {
      console.error("💥 Error fetching activity stats:", error);
      return [];
    }
  }
  
  /**
   * Get activity summary counts
   */
  static async getActivitySummary(days = 30) {
    try {
      const query = `
        SELECT 
          activity_type,
          COUNT(*) as count
        FROM activity_logs 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY activity_type
        ORDER BY count DESC
      `;
      
      const [summary] = await db.promise().query(query, [days]);
      return summary;
      
    } catch (error) {
      console.error("💥 Error fetching activity summary:", error);
      return [];
    }
  }
}

module.exports = ActivityLogger;