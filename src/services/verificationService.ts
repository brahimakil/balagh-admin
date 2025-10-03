import { collection, addDoc, query, where, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION_NAME = 'verificationCodes';
const BACKEND_URL = 'https://balaghemailbackend.vercel.app'; // or your backend URL

export interface VerificationCode {
  id?: string;
  email: string;
  code: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

export const verificationService = {
  // Send verification code via email
  async sendVerificationCode(email: string, userName?: string): Promise<void> {
    try {
      console.log('📧 Requesting verification code for:', email);
      
      // Call Gmail backend to send email
      const response = await fetch(`${BACKEND_URL}/api/notifications/send-verification-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, userName })
      });

      console.log('✅ Response status:', response.status);
      console.log('📬 Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Backend error:', errorData);
        throw new Error(errorData.error || 'Failed to send verification code');
      }

      const data = await response.json();
      console.log('✅ Backend response:', data);
      
      // ✅ Store code in localStorage instead of Firestore (no auth needed)
      localStorage.setItem('pendingVerificationCode', JSON.stringify({
        email,
        code: data.code,
        expiresAt: data.expiresAt
      }));

      console.log('✅ Verification code sent and stored locally');
    } catch (error) {
      console.error('❌ Error sending verification code:', error);
      throw error;
    }
  },

  // Verify code
  async verifyCode(email: string, code: string): Promise<boolean> {
    try {
      console.log('🔍 Verifying code for:', email);
      
      // Get code from localStorage
      const storedDataStr = localStorage.getItem('pendingVerificationCode');
      if (!storedDataStr) {
        console.log('❌ No stored code found');
        return false;
      }

      const storedData = JSON.parse(storedDataStr);
      
      // Check if email matches
      if (storedData.email !== email) {
        console.log('❌ Email mismatch');
        return false;
      }
      
      // Check if code matches
      if (storedData.code !== code) {
        console.log('❌ Code mismatch');
        return false;
      }
      
      // Check if expired
      const now = Date.now();
      if (now > storedData.expiresAt) {
        console.log('❌ Code expired');
        localStorage.removeItem('pendingVerificationCode');
        return false;
      }

      // Code is valid - remove it
      localStorage.removeItem('pendingVerificationCode');
      
      console.log('✅ Code verified successfully');
      return true;
    } catch (error) {
      console.error('❌ Error verifying code:', error);
      return false;
    }
  },

  // Clean up expired codes (call periodically)
  async cleanupExpiredCodes(): Promise<void> {
    try {
      const q = query(collection(db, COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      
      const now = new Date();
      const deletions: Promise<void>[] = [];

      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const expiresAt = data.expiresAt.toDate();
        
        if (now > expiresAt) {
          deletions.push(deleteDoc(doc.ref));
        }
      });

      await Promise.all(deletions);
      console.log(`🧹 Cleaned up ${deletions.length} expired codes`);
    } catch (error) {
      console.error('❌ Error cleaning up codes:', error);
    }
  }
};
