import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

export interface UploadedFile {
  url: string;
  fileName: string;
  fileType: 'image' | 'video';
}

export const fileUploadService = {
  // Upload a single file
  async uploadFile(
    file: File, 
    folderPath: string, 
    fileName?: string
  ): Promise<UploadedFile> {
    try {
      // Generate unique filename if not provided
      const finalFileName = fileName || `${Date.now()}_${file.name}`;
      const fileRef = ref(storage, `${folderPath}/${finalFileName}`);
      
      // Upload file
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Determine file type
      const fileType: 'image' | 'video' = file.type.startsWith('image/') ? 'image' : 'video';
      
      return {
        url: downloadURL,
        fileName: finalFileName,
        fileType
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  },

  // Upload multiple files
  async uploadMultipleFiles(
    files: File[], 
    folderPath: string
  ): Promise<UploadedFile[]> {
    try {
      const uploadPromises = files.map(file => 
        this.uploadFile(file, folderPath)
      );
      
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple files:', error);
      throw new Error('Failed to upload files');
    }
  },

  // Delete a file
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(fileUrl);
      const path = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
      const fileRef = ref(storage, path);
      
      await deleteObject(fileRef);
    } catch (error: any) {
      // If file doesn't exist, that's fine - it's already "deleted"
      if (error.code === 'storage/object-not-found') {
        console.warn(`File already deleted or doesn't exist: ${fileUrl}`);
        return; // Don't throw error, just continue
      }
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  },

  // Delete multiple files
  async deleteMultipleFiles(fileUrls: string[]): Promise<void> {
    const deletePromises = fileUrls.map(async (url) => {
      try {
        await this.deleteFile(url);
      } catch (error) {
        console.warn(`Failed to delete file ${url}:`, error);
        // Don't throw, just log and continue
      }
    });
    
    await Promise.all(deletePromises);
  },

  // Generate folder path for entity with support for 360 photos
  generateFolderPath(entityType: string, entityId: string, fileType: 'photos' | 'videos' | 'photos360'): string {
    return `${entityType}/${entityId}/${fileType}`;
  }
}; 