import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { Users, Plus, X, Check, Camera, Search } from 'lucide-react-native';
import { db, storage } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';

export default function CommunitiesScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupImage, setGroupImage] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (!user) return;

    // Listen for groups I'm a member of
    const q = query(
      collection(db, 'chats'),
      where('isGroup', '==', true),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGroups(groupList);
    });

    // Fetch contacts (users I have chats with)
    fetchContacts();

    return unsubscribe;
  }, [user]);

  const fetchContacts = async () => {
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid), where('isGroup', '!=', true));
    const snapshot = await getDocs(q);
    const contactList = snapshot.docs.map(doc => {
      const data = doc.data();
      const otherId = data.participants.find(p => p !== user.uid);
      return { id: otherId, ...data.participantDetails[otherId] };
    });
    // Remove duplicates
    const uniqueContacts = Array.from(new Map(contactList.map(c => [c.id, c])).values());
    setContacts(uniqueContacts);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setGroupImage(result.assets[0].uri);
  };

  const createGroup = async () => {
    if (!groupName.trim()) return Alert.alert('خطأ', 'يرجى إدخال اسم المجموعة');
    if (selectedContacts.length === 0) return Alert.alert('خطأ', 'يرجى اختيار عضو واحد على الأقل');

    setLoading(true);
    try {
      let imageUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(groupName) + '&background=random';

      if (groupImage) {
        const response = await fetch(groupImage);
        const blob = await response.blob();
        const filename = `groups/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      }

      const participantIds = [user.uid, ...selectedContacts.map(c => c.id)];
      const participantDetails = {
        [user.uid]: {
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          isAdmin: true
        }
      };
      selectedContacts.forEach(c => {
        participantDetails[c.id] = {
          displayName: c.displayName,
          photoURL: c.photoURL,
          isAdmin: false
        };
      });

      const newGroup = {
        name: groupName,
        description: groupDescription,
        photoURL: imageUrl,
        isGroup: true,
        createdBy: user.uid,
        participants: participantIds,
        participantDetails: participantDetails,
        lastMessage: 'تم إنشاء المجموعة',
        lastMessageTime: serverTimestamp(),
        unreadCount: participantIds.reduce((acc, id) => ({ ...acc, [id]: id === user.uid ? 0 : 1 }), {})
      };

      const docRef = await addDoc(collection(db, 'chats'), newGroup);

      // Initial message
      await addDoc(collection(db, 'chats', docRef.id, 'messages'), {
        text: `تم إنشاء المجموعة بواسطة ${profile.displayName}`,
        senderId: 'system',
        createdAt: serverTimestamp(),
        status: 'sent'
      });

      setModalVisible(false);
      resetForm();
      navigation.navigate('ChatRoom', { chatId: docRef.id, otherUser: { displayName: groupName, photoURL: imageUrl, isGroup: true } });
    } catch (error) {
      console.error(error);
      Alert.alert('خطأ', 'فشل إنشاء المجموعة');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setGroupName('');
    setGroupDescription('');
    setGroupImage(null);
    setSelectedContacts([]);
  };

  const toggleContact = (contact) => {
    if (selectedContacts.find(c => c.id === contact.id)) {
      setSelectedContacts(selectedContacts.filter(c => c.id !== contact.id));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  const filteredContacts = contacts.filter(c =>
    c.displayName.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.groupItem}
            onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, otherUser: { displayName: item.name, photoURL: item.photoURL, isGroup: true } })}
          >
            <Image source={{ uri: item.photoURL }} style={styles.groupAvatar} />
            <View style={styles.groupInfo}>
              <Text style={styles.groupName}>{item.name}</Text>
              <Text style={styles.groupLastMsg} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>المجتمعات</Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
              <Users size={24} color={theme.colors.primary} />
              <Text style={styles.createBtnText}>مجموعة جديدة</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Users size={80} color={theme.colors.border} />
            <Text style={styles.emptyText}>لا توجد مجموعات حالياً</Text>
            <Text style={styles.emptySubtext}>أنشئ مجموعة لجمع أصدقائك في مكان واحد</Text>
          </View>
        }
      />

      {/* Create Group Modal */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>مجموعة جديدة</Text>
            <TouchableOpacity onPress={createGroup} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Check size={24} color={theme.colors.primary} />}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.imagePickerSection}>
              <TouchableOpacity style={styles.imageCircle} onPress={handlePickImage}>
                {groupImage ? <Image source={{ uri: groupImage }} style={styles.imageCircle} /> : <Camera size={40} color={theme.colors.textSecondary} />}
              </TouchableOpacity>
              <TextInput
                style={styles.nameInput}
                placeholder="اسم المجموعة"
                placeholderTextColor={theme.colors.textSecondary}
                value={groupName}
                onChangeText={setGroupName}
              />
            </View>

            <TextInput
              style={styles.descInput}
              placeholder="وصف المجموعة (اختياري)"
              placeholderTextColor={theme.colors.textSecondary}
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
            />

            <View style={styles.contactSection}>
              <Text style={styles.sectionLabel}>إضافة أعضاء ({selectedContacts.length})</Text>
              <View style={styles.searchBar}>
                <Search size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="بحث..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={searchText}
                  onChangeText={setSearchText}
                />
              </View>

              {filteredContacts.map(contact => (
                <TouchableOpacity
                  key={contact.id}
                  style={styles.contactItem}
                  onPress={() => toggleContact(contact)}
                >
                  <Image source={{ uri: contact.photoURL }} style={styles.contactAvatar} />
                  <Text style={styles.contactName}>{contact.displayName}</Text>
                  <View style={[styles.checkbox, selectedContacts.find(c => c.id === contact.id) && styles.checkboxSelected]}>
                    {selectedContacts.find(c => c.id === contact.id) && <Check size={14} color={theme.colors.white} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: theme.colors.text, textAlign: 'right', marginBottom: 20 },
  createBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: theme.colors.surface, padding: 15, borderRadius: 12 },
  createBtnText: { color: theme.colors.primary, fontSize: 16, fontWeight: 'bold', marginRight: 15 },
  groupItem: { flexDirection: 'row-reverse', padding: 15, alignItems: 'center', borderBottomWidth: 0.2, borderBottomColor: theme.colors.border },
  groupAvatar: { width: 55, height: 55, borderRadius: 27.5 },
  groupInfo: { flex: 1, marginRight: 15, alignItems: 'flex-end' },
  groupName: { fontSize: 17, fontWeight: 'bold', color: theme.colors.text },
  groupLastMsg: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginTop: 20 },
  emptySubtext: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 10, textAlign: 'center', paddingHorizontal: 40 },
  modalContainer: { flex: 1, backgroundColor: theme.colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: theme.colors.surface },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text },
  modalContent: { flex: 1, padding: 20 },
  imagePickerSection: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 20 },
  imageCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' },
  nameInput: { flex: 1, marginRight: 15, fontSize: 18, color: theme.colors.text, borderBottomWidth: 1, borderBottomColor: theme.colors.primary, textAlign: 'right', paddingBottom: 5 },
  descInput: { backgroundColor: theme.colors.surface, borderRadius: 10, padding: 15, color: theme.colors.text, textAlign: 'right', marginBottom: 25 },
  contactSection: { marginTop: 10 },
  sectionLabel: { color: theme.colors.primary, fontWeight: 'bold', textAlign: 'right', marginBottom: 15 },
  searchBar: { flexDirection: 'row-reverse', backgroundColor: theme.colors.surface, borderRadius: 10, paddingHorizontal: 15, alignItems: 'center', height: 45, marginBottom: 15 },
  searchInput: { flex: 1, marginRight: 10, color: theme.colors.text, textAlign: 'right' },
  contactItem: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.2, borderBottomColor: theme.colors.border },
  contactAvatar: { width: 45, height: 45, borderRadius: 22.5 },
  contactName: { flex: 1, marginRight: 15, color: theme.colors.text, fontSize: 16, textAlign: 'right' },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
});
