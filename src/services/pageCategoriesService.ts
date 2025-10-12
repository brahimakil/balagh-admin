


import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    getDocs, 
    query,
    orderBy,
    Timestamp 
  } from 'firebase/firestore';
  import { db } from '../firebase';
  
  export interface PageCategory {
    id?: string;
    nameEn: string;
    nameAr: string;
    descriptionEn?: string;
    descriptionAr?: string;
    displayOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
  
  const COLLECTION_NAME = 'pageCategories';
  
  export const pageCategoriesService = {
    // Get all categories
    async getAllCategories(): Promise<PageCategory[]> {
      const q = query(collection(db, COLLECTION_NAME), orderBy('displayOrder', 'asc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as PageCategory[];
    },
  
    // Get active categories only
    async getActiveCategories(): Promise<PageCategory[]> {
      const categories = await this.getAllCategories();
      return categories.filter(cat => cat.isActive);
    },
  
    // Create new category
    async createCategory(categoryData: Omit<PageCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...categoryData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return docRef.id;
    },
  
    // Update category
    async updateCategory(id: string, categoryData: Partial<PageCategory>): Promise<void> {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...categoryData,
        updatedAt: Timestamp.now(),
      });
    },
  
    // Delete category
    async deleteCategory(id: string): Promise<void> {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    },
  };