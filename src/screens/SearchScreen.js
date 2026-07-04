import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Search as SearchIcon, ArrowRight } from 'lucide-react-native';
import { theme } from '../theme';
import { collection, query, where, getDocs, addDoc, serverTimestamp, or, and } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';

export default function SearchScreen({ navigation }) {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('displayName', '>=', searchText),
        where('displayName', '<=', searchText + '\uf8ff')
      );
      const querySnapshot = await getDocs(q);
      const users = [];
      querySnapshot.forEach((doc) => {
        if (doc.id !== user.uid) {
          users.push({ id: doc.id, ...doc.data() });
        }
      });
      setResults(users);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (otherUser) => {
    try {
      // Check if chat already exists
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', user.uid)
      );

      const querySnapshot = await getDocs(q);
      let existingChatId = null;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.participants.includes(otherUser.uid)) {
          existingChatId = doc.id;
        }
      });

      if (existingChatId) {
        navigation.navigate('ChatRoom', { chatId: existingChatId, otherUser });
        return;
      }

      const chatData = {
        participants: [user.uid, otherUser.uid],
        participantDetails: {
          [user.uid]: { displayName: profile.displayName, photoURL: profile.photoURL },
          [otherUser.uid]: { displayName: otherUser.displayName, photoURL: otherUser.photoURL }
        },
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'chats'), chatData);
      navigation.navigate('ChatRoom', { chatId: docRef.id, otherUser });
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="ابحث عن مستخدم بالاسم..."
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
            <TouchableOpacity style={styles.resultItem} onPress={() => startChat(item)}>
              <Image source={{ uri: item.photoURL }} style={styles.avatar} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.displayName}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
            </TouchableOpacity>
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
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    borderRadius: 25,
    paddingHorizontal: 15,
    alignItems: 'center',
    height: 50,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    textAlign: 'right',
    marginRight: 10,
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
  status: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  }
});
