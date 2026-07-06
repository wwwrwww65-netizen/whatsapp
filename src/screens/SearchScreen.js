import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Search as SearchIcon, MessageCircle, UserPlus, CheckCircle2 } from 'lucide-react-native';
import { theme } from '../theme';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  or,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';

export default function SearchScreen({ navigation }) {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingIds, setAddingIds] = useState({}); // To track loading state for each user being added
  const [addedIds, setAddedIds] = useState({}); // To track which users are already added
  const { user, profile } = useAuth();

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setLoading(true);
    try {
      // Search by displayName or username
      const usersRef = collection(db, 'users');

      // Firestore doesn't support complex 'or' with range queries easily in client SDK,
      // so we do two separate checks or use a simple query if we want partial match
      const q = query(
        usersRef,
        where('displayName', '>=', searchText),
        where('displayName', '<=', searchText + '\uf8ff')
      );

      const qUsername = query(
        usersRef,
        where('username', '==', searchText.toLowerCase())
      );

      const [snap1, snap2] = await Promise.all([getDocs(q), getDocs(qUsername)]);

      const users = new Map();
      snap1.forEach((doc) => {
        if (doc.id !== user.uid) {
          users.set(doc.id, { id: doc.id, ...doc.data() });
        }
      });
      snap2.forEach((doc) => {
        if (doc.id !== user.uid) {
          users.set(doc.id, { id: doc.id, ...doc.data() });
        }
      });

      // Check which of these are already in chats
      const chatsRef = collection(db, 'chats');
      const chatQuery = query(chatsRef, where('participants', 'array-contains', user.uid));
      const chatSnap = await getDocs(chatQuery);

      const alreadyAdded = {};
      chatSnap.forEach(chatDoc => {
        const data = chatDoc.data();
        const otherId = data.participants.find(p => p !== user.uid);
        if (otherId) alreadyAdded[otherId] = chatDoc.id;
      });

      setAddedIds(alreadyAdded);
      setResults(Array.from(users.values()));
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const addFriend = async (otherUser) => {
    if (addingIds[otherUser.id] || addedIds[otherUser.id]) return;

    setAddingIds(prev => ({ ...prev, [otherUser.id]: true }));
    try {
      const chatData = {
        participants: [user.uid, otherUser.id],
        participantDetails: {
          [user.uid]: {
            displayName: profile.displayName,
            username: profile.username || '',
            photoURL: profile.photoURL
          },
          [otherUser.id]: {
            displayName: otherUser.displayName,
            username: otherUser.username || '',
            photoURL: otherUser.photoURL
          }
        },
        lastMessage: 'تمت إضافتك كصديق',
        lastMessageTime: serverTimestamp(),
        unreadCount: {
          [user.uid]: 0,
          [otherUser.id]: 1
        }
      };

      const docRef = await addDoc(collection(db, 'chats'), chatData);
      setAddedIds(prev => ({ ...prev, [otherUser.id]: docRef.id }));
    } catch (error) {
      console.error("Error adding friend:", error);
      alert('حدث خطأ أثناء الإضافة');
    } finally {
      setAddingIds(prev => ({ ...prev, [otherUser.id]: false }));
    }
  };

  const startChat = (otherUser) => {
    const chatId = addedIds[otherUser.id];
    if (chatId) {
      navigation.navigate('ChatRoom', { chatId, otherUser });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="ابحث بالاسم أو اسم المستخدم..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity onPress={handleSearch}>
          <SearchIcon size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.resultItem}>
              <Image source={{ uri: item.photoURL }} style={styles.avatar} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.displayName}</Text>
                <Text style={styles.username}>@{item.username}</Text>
              </View>

              <View style={styles.actions}>
                {addedIds[item.id] ? (
                  <View style={styles.addedContainer}>
                    <TouchableOpacity
                      style={styles.chatBtn}
                      onPress={() => startChat(item)}
                    >
                      <MessageCircle size={22} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <View style={styles.statusBadge}>
                      <Text style={styles.addedText}>تمت الإضافة</Text>
                      <CheckCircle2 size={16} color={theme.colors.primary} />
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => addFriend(item)}
                    disabled={addingIds[item.id]}
                  >
                    {addingIds[item.id] ? (
                      <ActivityIndicator size="small" color={theme.colors.white} />
                    ) : (
                      <>
                        <Text style={styles.addBtnText}>إضافة</Text>
                        <UserPlus size={18} color={theme.colors.white} />
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            searchText && !loading ? <Text style={styles.emptyText}>لا توجد نتائج</Text> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    borderRadius: 25,
    paddingHorizontal: 15,
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    textAlign: 'right',
    marginLeft: 10,
  },
  resultItem: {
    flexDirection: 'row-reverse',
    padding: theme.spacing.md,
    alignItems: 'center',
    borderBottomWidth: 0.2,
    borderBottomColor: theme.colors.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginLeft: 15,
  },
  info: {
    flex: 1,
    alignItems: 'flex-end',
  },
  name: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  username: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    alignItems: 'center',
  },
  addBtnText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  addedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 168, 132, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  addedText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  chatBtn: {
    marginRight: 10,
    padding: 5,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  }
});
