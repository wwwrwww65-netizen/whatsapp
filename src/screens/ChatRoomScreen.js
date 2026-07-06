import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import { ChevronRight, Phone, Video, MoreVertical, Smile, Paperclip, Mic, Send, Check, CheckCheck } from 'lucide-react-native';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  getDocs,
  where,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function ChatRoomScreen({ route, navigation }) {
  const { chatId, otherUser } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [otherUserStatus, setOtherUserStatus] = useState({ isOnline: false, lastSeen: null });
  const flatListRef = useRef();

  useEffect(() => {
    if (!chatId) return;

    // Listen for messages
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);

      // Mark messages as read (unread count)
      markAsRead();

      // Update individual messages to 'seen' status
      updateMessagesToSeen(snapshot.docs);
    });

    // Listen for other user status
    const userRef = doc(db, 'users', otherUser.id || otherUser.uid);
    const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setOtherUserStatus(docSnap.data());
      }
    });

    return () => {
      unsubscribe();
      unsubscribeUser();
    };
  }, [chatId]);

  const markAsRead = async () => {
    try {
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        [`unreadCount.${user.uid}`]: 0
      });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const updateMessagesToSeen = async (docSnapshots) => {
    try {
      const batch = writeBatch(db);
      let hasChanges = false;

      docSnapshots.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.senderId !== user.uid && data.status !== 'seen') {
          batch.update(docSnap.ref, { status: 'seen' });
          hasChanges = true;
        }
      });

      if (hasChanges) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Error updating messages to seen:", error);
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    setInputText('');

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        text: text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        status: 'sent' // sent, delivered, seen
      });

      // Update last message in the chat document
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        [`unreadCount.${otherUser.id || otherUser.uid}`]: increment(1)
      });
    } catch (error) {
      console.error("Error sending message:", error);
      alert('فشل إرسال الرسالة');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `chats/${chatId}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        text: '',
        imageUrl: downloadURL,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        status: 'sent'
      });

      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: 'صورة',
        lastMessageTime: serverTimestamp(),
        [`unreadCount.${otherUser.id || otherUser.uid}`]: increment(1)
      });
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  const renderStatus = (isOnline, lastSeen) => {
    if (isOnline) return 'متصل الآن';
    if (lastSeen) {
      try {
        const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
        return `آخر ظهور ${format(date, 'p', { locale: ar })}`;
      } catch (e) {
        return 'غير متصل';
      }
    }
    return 'غير متصل';
  };

  const renderMessage = ({ item }) => {
    const isMine = item.senderId === user.uid;
    const time = item.createdAt ? format(item.createdAt.toDate(), 'p', { locale: ar }) : '';

    return (
      <View style={[styles.messageWrapper, isMine ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
        <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.theirBubble]}>
          {item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
          )}
          {item.text ? <Text style={styles.messageText}>{item.text}</Text> : null}
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{time}</Text>
            {isMine && (
              <View style={styles.statusIcon}>
                <CheckCheck size={14} color={item.status === 'seen' ? '#34B7F1' : theme.colors.textSecondary} />
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronRight size={28} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerUser} activeOpacity={0.7}>
          <View style={styles.headerInfo}>
            <Text style={styles.userName}>{otherUser.displayName}</Text>
            <Text style={[styles.userStatus, otherUserStatus.isOnline && { color: theme.colors.primary }]}>
              {renderStatus(otherUserStatus.isOnline, otherUserStatus.lastSeen)}
            </Text>
          </View>
          <Image source={{ uri: otherUser.photoURL }} style={styles.headerAvatar} />
        </TouchableOpacity>

        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIcon}>
            <Video size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Phone size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <MoreVertical size={22} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Background */}
      <ImageBackground
        source={{ uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' }}
        style={styles.chatBackground}
        imageStyle={{ opacity: 0.05 }}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input Bar */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              {inputText.trim() ? (
                <Send size={24} color={theme.colors.white} />
              ) : (
                <Mic size={24} color={theme.colors.white} />
              )}
            </TouchableOpacity>

            <View style={styles.textInputContainer}>
              <TouchableOpacity onPress={pickImage}>
                <Paperclip size={24} color={theme.colors.textSecondary} style={styles.inputIcon} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="الرسالة"
                placeholderTextColor={theme.colors.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
              <TouchableOpacity>
                <Smile size={24} color={theme.colors.textSecondary} style={styles.inputIcon} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    height: 60,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: Platform.OS === 'ios' ? 40 : 0,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    padding: 5,
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 10,
  },
  headerInfo: {
    alignItems: 'flex-end',
  },
  userName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  userStatus: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  headerIcon: {
    marginLeft: 15,
  },
  chatBackground: {
    flex: 1,
    backgroundColor: '#0B141B',
  },
  messagesList: {
    padding: 12,
    paddingBottom: 20,
  },
  messageWrapper: {
    marginBottom: 4,
    width: '100%',
  },
  myMessageWrapper: {
    alignItems: 'flex-end',
  },
  theirMessageWrapper: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 8,
    borderRadius: 12,
    position: 'relative',
    elevation: 1,
  },
  myBubble: {
    backgroundColor: theme.colors.bubbleSelf,
    borderTopRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: theme.colors.bubbleOther,
    borderTopLeftRadius: 2,
  },
  messageText: {
    color: theme.colors.text,
    fontSize: 16,
    textAlign: 'right',
    lineHeight: 22,
  },
  messageImage: {
    width: 240,
    height: 240,
    borderRadius: 8,
    marginBottom: 5,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(233, 237, 239, 0.6)',
  },
  statusIcon: {
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row-reverse',
    padding: 8,
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    backgroundColor: theme.colors.surface,
    borderRadius: 25,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 48,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    maxHeight: 120,
    textAlign: 'right',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  inputIcon: {
    marginHorizontal: 4,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  }
});
