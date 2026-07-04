import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import Header from '../components/Header';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { MessageSquarePlus } from 'lucide-react-native';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function ChatsScreen({ navigation }) {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => {
        const data = doc.data();
        const otherUserId = data.participants.find(id => id !== user.uid);
        const otherUser = data.participantDetails[otherUserId];

        return {
          id: doc.id,
          user: { ...otherUser, uid: otherUserId },
          lastMessage: data.lastMessage,
          lastMessageTime: data.lastMessageTime ? format(data.lastMessageTime.toDate(), 'p', { locale: ar }) : '',
        };
      });
      setChats(chatList);
    });

    return unsubscribe;
  }, [user]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, otherUser: item.user })}
    >
      <Image source={{ uri: item.user.photoURL }} style={styles.avatar} />
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTime}>{item.lastMessageTime}</Text>
          <Text style={styles.chatName}>{item.user.displayName}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header title="هش" />

      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>لا توجد دردشات حالياً</Text>
          <Text style={styles.emptySubtext}>ابدأ بالبحث عن أصدقائك للدردشة معهم</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={item => item.id}
          renderItem={renderItem}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Search')}
      >
        <MessageSquarePlus color={theme.colors.white} size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  chatItem: {
    flexDirection: 'row-reverse',
    padding: theme.spacing.md,
    alignItems: 'center',
    borderBottomWidth: 0.2,
    borderBottomColor: theme.colors.border,
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    marginLeft: theme.spacing.md,
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  chatName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'right',
  },
  chatTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  lastMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: theme.colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  }
});
