import React, { createContext, useState, useEffect, useContext } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({});

const USER_SESSION_KEY = '@hash_user_id';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const savedUserId = await AsyncStorage.getItem(USER_SESSION_KEY);
      if (savedUserId) {
        const docRef = doc(db, 'users', savedUserId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setUser({ uid: savedUserId });
          setProfile(userData);
          // Update online status
          await updateDoc(docRef, {
            isOnline: true,
            lastSeen: serverTimestamp()
          });
        } else {
          await AsyncStorage.removeItem(USER_SESSION_KEY);
        }
      }
    } catch (error) {
      console.error("Check session failed", error);
    } finally {
      setLoading(false);
    }
  };

  const generateRandomUsername = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 9; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const register = async (displayName, username, password) => {
    try {
      let finalUsername = username?.trim() || generateRandomUsername();

      // Check if username already exists
      const usernameQuery = query(collection(db, 'users'), where('username', '==', finalUsername));
      const querySnapshot = await getDocs(usernameQuery);

      if (!querySnapshot.empty) {
        throw new Error('اسم المستخدم موجود بالفعل');
      }

      const userId = Math.random().toString(36).substring(2, 15);
      const userProfile = {
        uid: userId,
        displayName: displayName,
        username: finalUsername,
        password: password, // As requested, stored in DB (not recommended for production but following requirements)
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
        status: 'مرحباً، أنا أستخدم هش!',
        createdAt: serverTimestamp(),
        isOnline: true,
        lastSeen: serverTimestamp()
      };

      await setDoc(doc(db, 'users', userId), userProfile);
      await AsyncStorage.setItem(USER_SESSION_KEY, userId);

      setUser({ uid: userId });
      setProfile(userProfile);
      return userProfile;
    } catch (error) {
      console.error("Registration failed", error);
      throw error;
    }
  };

  const login = async (identifier, password) => {
    try {
      // Search by username or displayName
      const q1 = query(collection(db, 'users'), where('username', '==', identifier));
      const q2 = query(collection(db, 'users'), where('displayName', '==', identifier));

      let userDoc = null;
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        userDoc = snap1.docs[0];
      } else {
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          userDoc = snap2.docs[0];
        }
      }

      if (!userDoc) {
        throw new Error('المستخدم غير موجود');
      }

      const userData = userDoc.data();
      if (userData.password !== password) {
        throw new Error('كلمة المرور غير صحيحة');
      }

      await AsyncStorage.setItem(USER_SESSION_KEY, userDoc.id);

      // Update online status
      await updateDoc(doc(db, 'users', userDoc.id), {
        isOnline: true,
        lastSeen: serverTimestamp()
      });

      setUser({ uid: userDoc.id });
      setProfile(userData);
      return userData;
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          isOnline: false,
          lastSeen: serverTimestamp()
        });
      }
      await AsyncStorage.removeItem(USER_SESSION_KEY);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const updateProfile = async (updates) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, updates);
      const newProfile = { ...profile, ...updates };
      setProfile(newProfile);
    } catch (error) {
      console.error("Update profile failed", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
