import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions
} from 'react-native';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { Camera, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { db, storage } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const { width } = Dimensions.get('window');

export default function UpdatesScreen() {
  const { user, profile } = useAuth();
  const [statuses, setStatuses] = useState([]);
  const [myStatuses, setMyStatuses] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedStatusItems, setSelectedStatusItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'status'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allStatus = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const now = new Date().getTime();
      const validStatus = allStatus.filter(s => {
        const createdAt = s.createdAt?.toMillis() || now;
        return now - createdAt < 24 * 60 * 60 * 1000;
      });
      setMyStatuses(validStatus.filter(s => s.userId === user.uid).sort((a,b) => a.createdAt?.toMillis() - b.createdAt?.toMillis()));
      const others = validStatus.filter(s => s.userId !== user.uid);
      const grouped = others.reduce((acc, current) => {
        if (!acc[current.userId]) {
          acc[current.userId] = { userId: current.userId, displayName: current.displayName, photoURL: current.photoURL, items: [] };
        }
        acc[current.userId].items.push(current);
        return acc;
      }, {});
      Object.values(grouped).forEach(g => g.items.sort((a,b) => a.createdAt?.toMillis() - b.createdAt?.toMillis()));
      setStatuses(Object.values(grouped));
    });
    return unsubscribe;
  }, [user]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7 });
    if (!result.canceled) uploadStatus(result.assets[0].uri);
  };

  const uploadStatus = async (uri) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `status/${user.uid}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      await addDoc(collection(db, 'status'), { userId: user.uid, displayName: profile.displayName, photoURL: profile.photoURL, imageUrl: downloadURL, createdAt: serverTimestamp() });
      Alert.alert('نجاح', 'تم نشر الحالة');
    } catch (error) {
      console.error(error);
      Alert.alert('خطأ', 'فشل نشر الحالة');
    } finally {
      setUploading(false);
    }
  };

  const openViewer = (items) => {
    setSelectedStatusItems(items);
    setCurrentIndex(0);
    setViewerVisible(true);
  };

  const nextStatus = () => {
    if (currentIndex < selectedStatusItems.length - 1) setCurrentIndex(currentIndex + 1);
    else setViewerVisible(false);
  };

  const prevStatus = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <Text style={styles.sectionTitle}>الحالة</Text>
        <TouchableOpacity style={styles.statusItem} onPress={() => myStatuses.length > 0 ? openViewer(myStatuses) : handlePickImage()}>
          <View style={styles.myStatusContainer}>
            <Image source={{ uri: profile?.photoURL }} style={styles.statusAvatar} />
            <View style={styles.plusIcon}><Plus size={14} color={theme.colors.white} /></View>
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusName}>حالتي</Text>
            <Text style={styles.statusTime}>انقر لإضافة تحديث حالة</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.subSectionTitle}>التحديثات الأخيرة</Text>
        {statuses.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyText}>لا توجد تحديثات حالياً</Text></View> : statuses.map((item) => (
          <TouchableOpacity key={item.userId} style={styles.statusItem} onPress={() => openViewer(item.items)}>
            <View style={styles.statusRing}><Image source={{ uri: item.photoURL }} style={styles.statusAvatar} /></View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusName}>{item.displayName}</Text>
              <Text style={styles.statusTime}>{item.items[0]?.createdAt ? formatDistanceToNow(item.items[item.items.length-1].createdAt.toDate(), { addSuffix: true, locale: ar }) : ''}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={viewerVisible} transparent={false} animationType="fade">
        <View style={styles.viewerContainer}>
          {selectedStatusItems[currentIndex] && (
            <>
              <Image source={{ uri: selectedStatusItems[currentIndex].imageUrl }} style={styles.viewerImage} resizeMode="contain" />
              <View style={styles.viewerHeader}>
                <View style={styles.progressBarContainer}>
                  {selectedStatusItems.map((_, i) => (
                    <View key={i} style={[styles.progressBar, { width: (width - 60) / selectedStatusItems.length }, i <= currentIndex ? styles.progressBarActive : styles.progressBarInactive]} />
                  ))}
                </View>
                <View style={styles.viewerUserInfo}>
                  <Image source={{ uri: selectedStatusItems[currentIndex].photoURL }} style={styles.viewerAvatar} />
                  <View><Text style={styles.viewerName}>{selectedStatusItems[currentIndex].displayName}</Text>
                  <Text style={styles.viewerTime}>{selectedStatusItems[currentIndex].createdAt ? formatDistanceToNow(selectedStatusItems[currentIndex].createdAt.toDate(), { addSuffix: true, locale: ar }) : ''}</Text></View>
                </View>
                <TouchableOpacity onPress={() => setViewerVisible(false)}><X size={30} color={theme.colors.white} /></TouchableOpacity>
              </View>
              <View style={styles.navigationOverlay}>
                <TouchableOpacity style={styles.navTouch} onPress={prevStatus} />
                <TouchableOpacity style={styles.navTouch} onPress={nextStatus} />
              </View>
            </>
          )}
        </View>
      </Modal>
      <TouchableOpacity style={styles.fab} onPress={handlePickImage}><Camera color={theme.colors.white} size={24} /></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: theme.colors.text, padding: 20, textAlign: 'right' },
  subSectionTitle: { fontSize: 14, color: theme.colors.textSecondary, paddingHorizontal: 20, paddingVertical: 10, textAlign: 'right' },
  statusItem: { flexDirection: 'row-reverse', padding: 15, alignItems: 'center' },
  statusRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: theme.colors.primary, padding: 2, justifyContent: 'center', alignItems: 'center' },
  myStatusContainer: { position: 'relative' },
  statusAvatar: { width: 50, height: 50, borderRadius: 25 },
  plusIcon: { position: 'absolute', bottom: 0, left: 0, backgroundColor: theme.colors.primary, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  statusInfo: { flex: 1, marginRight: 15, alignItems: 'flex-end' },
  statusName: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  statusTime: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: theme.colors.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  viewerContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerHeader: { position: 'absolute', top: 40, left: 0, right: 0, paddingHorizontal: 20 },
  progressBarContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  progressBar: { height: 3, borderRadius: 2 },
  progressBarActive: { backgroundColor: '#fff' },
  progressBarInactive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  viewerUserInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  viewerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  viewerName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  viewerTime: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  navigationOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  navTouch: { flex: 1 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: theme.colors.textSecondary, fontSize: 16 }
});
