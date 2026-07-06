import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import Header from '../components/Header';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { MessageSquarePlus, Check, CheckCheck } from 'lucide-react-native';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { format, isToday, isYesterday } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function ChatsScreen({ navigation }) {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (!user) return;

    // Initially query without orderBy to ensure chats appear even if index is building
    // or if some chats have no lastMessageTime yet
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => {
        const data = doc.data();
        const otherUserId = data.participants.find(id => id !== user.uid);
        const otherUser = data.participantDetails[otherUserId];
        const unreadCount = data.unreadCount ? data.unreadCount[user.uid] : 0;

        let timeStr = '';
        if (data.lastMessageTime) {
          const date = data.lastMessageTime.toDate();
          if (isToday(date)) {
            timeStr = format(date, 'p', { locale: ar });
          } else if (isYesterday(date)) {
            timeStr = 'أمس';
          } else {
            timeStr = format(date, 'dd/MM/yyyy');
          }
        }

        return {
          id: doc.id,
          user: { ...otherUser, id: otherUserId },
          lastMessage: data.lastMessage,
          lastMessageTime: timeStr,
          rawTime: data.lastMessageTime,
          unreadCount,
          lastMessageSenderId: data.lastMessageSenderId,
          lastMessageStatus: data.lastMessageStatus,
        };
      });
      // Sort in-memory to avoid index requirements for now
      const sortedList = chatList.sort((a, b) => {
        const timeA = a.rawTime ? a.rawTime.toMillis() : 0;
        const timeB = b.rawTime ? b.rawTime.toMillis() : 0;
        return timeB - timeA;
      });
      setChats(sortedList);
    });

    return unsubscribe;
  }, [user]);

  const renderItem = ({ item }) => {
    const isMine = item.lastMessageSenderId === user.uid;

    const renderStatusIcon = () => {
      if (!isMine || !item.lastMessageStatus) return null;
      if (item.lastMessageStatus === 'sent') {
        return <Check size={16} color={theme.colors.textSecondary} style={{ marginLeft: 4 }} />;
      }
      return (
        <CheckCheck
          size={16}
          color={item.lastMessageStatus === 'seen' ? '#34B7F1' : theme.colors.textSecondary}
          style={{ marginLeft: 4 }}
        />
      );
    };

    return (
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
          <View style={styles.chatFooter}>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
            <View style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center' }}>
              {renderStatusIcon()}
              <Text style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadLastMessage]} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  unreadLastMessage: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: theme.colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: 'bold',
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
