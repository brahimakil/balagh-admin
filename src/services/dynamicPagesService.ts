import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query,
  orderBy,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { fileUploadService, type UploadedFile } from './fileUploadService';

export interface DynamicPageSection {
  id: string;
  type: 'text' | 'photos' | 'videos';
  titleEn: string;
  titleAr: string;
  contentEn?: string; // Only for text sections
  contentAr?: string; // Only for text sections
  media?: {
    url: string;
    fileType: 'image' | 'video';
    uploadedAt: string; // Changed from Date to string
  }[];
  order: number;
}

export interface DynamicPage {
  id?: string;
  titleEn: string;
  titleAr: string;
  slug: string;
  descriptionEn: string;
  descriptionAr: string;
  bannerImage: string;
  bannerTitleEn: string;
  bannerTitleAr: string;
  bannerTextEn: string;
  bannerTextAr: string;
  bannerColorOverlay: string;
  showBannerOverlay: boolean;
  bannerTitleColor?: string; // ✅ NEW: Banner title text color
  bannerDescriptionColor?: string; // ✅ NEW: Banner description text color
  sections: DynamicPageSection[];
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'dynamicPages';

export const dynamicPagesService = {
  // Get all dynamic pages
  async getAllPages(): Promise<DynamicPage[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('displayOrder', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as DynamicPage[];
  },

  // Get active pages only (for frontend)
  async getActivePages(): Promise<DynamicPage[]> {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where('isActive', '==', true),
      orderBy('displayOrder', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as DynamicPage[];
  },

  // Create new page
  async createPage(pageData: Omit<DynamicPage, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await addDoc(collection(db, COLLECTION_NAME), {
      ...pageData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  },

  // Update page
  async updatePage(id: string, pageData: Partial<DynamicPage>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...pageData,
      updatedAt: Timestamp.now(),
    });
  },

  // Delete page
  async deletePage(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  },

  // Generate unique slug
  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  },

  // Check if slug is unique
  async isSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    const q = query(collection(db, COLLECTION_NAME), where('slug', '==', slug));
    const querySnapshot = await getDocs(q);
    
    if (excludeId) {
      return querySnapshot.docs.every(doc => doc.id !== excludeId);
    }
    
    return querySnapshot.empty;
  }
};
