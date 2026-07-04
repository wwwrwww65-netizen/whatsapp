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
  ImageBackground
} from 'react-native';
import { ChevronRight, Phone, Video, MoreVertical, Smile, Paperclip, Mic, Send } from 'lucide-react-native';
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
  setDoc,
  updateDoc
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
  const flatListRef = useRef();

  useEffect(() => {
    if (!chatId) return;

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
    });

    return unsubscribe;
  }, [chatId]);

  const sendMessage = async (text = null, imageUrl = null) => {
    if (!text?.trim() && !imageUrl) return;

    const msgText = text?.trim() || '';
    setInputText('');

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        text: msgText,
        imageUrl: imageUrl,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });

      // Update last message in the chat document
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: imageUrl ? 'صورة' : msgText,
        lastMessageTime: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
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
      sendMessage(null, downloadURL);
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  const renderMessage = ({ item }) => {
    const isMine = item.senderId === user.uid;
    const time = item.createdAt ? format(item.createdAt.toDate(), 'p', { locale: ar }) : '';

    return (
      <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
        )}
        {item.text ? <Text style={styles.messageText}>{item.text}</Text> : null}
        <Text style={styles.messageTime}>{time}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronRight size={28} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{otherUser.displayName}</Text>
          <Text style={styles.userStatus}>متصل الآن</Text>
        </View>

        <Image source={{ uri: otherUser.photoURL }} style={styles.headerAvatar} />

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
            <TouchableOpacity style={styles.micButton} onPress={sendMessage}>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: Platform.OS === 'ios' ? 40 : 0,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 10,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  userName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  userStatus: {
    color: theme.colors.primary,
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
    resizeMode: 'cover',
  },
  messagesList: {
    padding: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 8,
    borderRadius: 10,
    marginBottom: 5,
    position: 'relative',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.bubbleSelf,
    borderTopRightRadius: 0,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.bubbleOther,
    borderTopLeftRadius: 0,
  },
  messageText: {
    color: theme.colors.text,
    fontSize: 16,
    textAlign: 'right',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 5,
  },
  messageTime: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    alignItems: 'flex-end',
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 25,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 45,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    maxHeight: 100,
    textAlign: 'right',
    paddingVertical: 8,
  },
  inputIcon: {
    marginHorizontal: 8,
  },
  micButton: {
    backgroundColor: theme.colors.primary,
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  }
});
