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
  Modal,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { ChevronRight, Phone, Video, MoreVertical, Smile, Paperclip, Mic, Send, Check, CheckCheck, Trash2, User as UserIcon, X, Play, Pause } from 'lucide-react-native';
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
  getDoc,
  getDocs,
  where,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { ref as dbRef, onValue } from 'firebase/database';
import { db, storage, rtdb } from '../services/firebase';
import { format, isToday, isYesterday } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Audio } from 'expo-av';

export default function ChatRoomScreen({ route, navigation }) {
  const { chatId, otherUser } = route.params;
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [otherUserStatus, setOtherUserStatus] = useState({ isOnline: false, lastSeen: null });
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const soundRef = useRef(null);
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

    // Listen for other user status from RTDB (Real-time Presence)
    const statusRef = dbRef(rtdb, `/status/${otherUser.id || otherUser.uid}`);
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setOtherUserStatus({
          isOnline: data.state === 'online',
          lastSeen: data.last_changed
        });
      } else {
        // Fallback to Firestore if RTDB data doesn't exist yet
        const userRef = doc(db, 'users', otherUser.id || otherUser.uid);
        getDoc(userRef).then(docSnap => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setOtherUserStatus({
              isOnline: userData.isOnline,
              lastSeen: userData.lastSeen
            });
          }
        });
      }
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
      if (soundRef.current) soundRef.current.unloadAsync();
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
        // Also update the chat document's lastMessageStatus
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
          lastMessageStatus: 'seen'
        });
      }
    } catch (error) {
      console.error("Error updating messages to seen:", error);
    }
  };

  const sendMessage = async (type = 'text', content = null) => {
    const text = type === 'text' ? inputText.trim() : '';
    if (type === 'text' && !text) return;

    const currentReplyTo = replyTo;
    if (type === 'text') setInputText('');
    setReplyTo(null);

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const msgData = {
        senderId: user.uid,
        createdAt: serverTimestamp(),
        status: 'sent',
        replyTo: currentReplyTo ? {
          id: currentReplyTo.id,
          text: currentReplyTo.text,
          senderId: currentReplyTo.senderId
        } : null
      };

      if (type === 'text') msgData.text = text;
      if (type === 'audio') {
        msgData.audioUrl = content.url;
        msgData.audioDuration = content.duration;
        msgData.text = '';
      }

      await addDoc(messagesRef, msgData);

      // Update last message in the chat document
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      const chatData = chatSnap.data();

      const updates = {
        lastMessage: type === 'audio' ? 'رسالة صوتية' : text,
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: user.uid,
        lastMessageStatus: 'sent',
      };

      // Handle unread counts for all participants (Groups support)
      if (chatData.isGroup) {
        chatData.participants.forEach(pId => {
          if (pId !== user.uid) {
            updates[`unreadCount.${pId}`] = increment(1);
          }
        });
      } else {
        const otherId = chatData.participants.find(p => p !== user.uid);
        updates[`unreadCount.${otherId}`] = increment(1);
      }

      await updateDoc(chatRef, updates);
    } catch (error) {
      console.error("Error sending message:", error);
      alert('فشل إرسال الرسالة');
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(recording);
        setIsRecording(true);
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const { durationMillis } = await recording.getStatusAsync();

      // Upload to Firebase
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `voice/${chatId}/${Date.now()}.m4a`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      sendMessage('audio', { url, duration: durationMillis });
      setRecording(null);
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const playPauseAudio = async (messageId, url) => {
    try {
      if (playingId === messageId) {
        await soundRef.current.pauseAsync();
        setPlayingId(null);
      } else {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }
        const { sound } = await Audio.Sound.createAsync({ uri: url });
        soundRef.current = sound;
        setPlayingId(messageId);
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) setPlayingId(null);
        });
      }
    } catch (err) {
      console.error('Playback error', err);
    }
  };

  const deleteMessage = async (messageId, forEveryone = false) => {
    try {
      if (forEveryone) {
        await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
          text: 'تم حذف هذه الرسالة',
          imageUrl: null,
          audioUrl: null,
          isDeleted: true,
          status: 'deleted'
        });
      } else {
        await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
          [`deletedFor.${user.uid}`]: true
        });
      }
      setSelectedMessage(null);
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const clearChat = async () => {
    setMenuVisible(false);
    Alert.alert(
      'مسح الدردشة',
      'هل أنت متأكد من رغبتك في مسح جميع الرسائل في هذه الدردشة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'مسح',
          style: 'destructive',
          onPress: async () => {
            try {
              const messagesRef = collection(db, 'chats', chatId, 'messages');
              const snapshot = await getDocs(messagesRef);
              const batch = writeBatch(db);
              snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
              });
              await batch.commit();

              const chatRef = doc(db, 'chats', chatId);
              await updateDoc(chatRef, {
                lastMessage: 'تم مسح الدردشة',
                lastMessageTime: serverTimestamp(),
                [`unreadCount.${user.uid}`]: 0
              });
            } catch (error) {
              console.error("Error clearing chat:", error);
            }
          }
        }
      ]
    );
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) uploadImage(result.assets[0].uri);
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
      const chatSnap = await getDoc(chatRef);
      const chatData = chatSnap.data();

      const updates = {
        lastMessage: 'صورة',
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: user.uid,
        lastMessageStatus: 'sent',
      };

      if (chatData.isGroup) {
        chatData.participants.forEach(pId => {
          if (pId !== user.uid) updates[`unreadCount.${pId}`] = increment(1);
        });
      } else {
        const otherId = chatData.participants.find(p => p !== user.uid);
        updates[`unreadCount.${otherId}`] = increment(1);
      }

      await updateDoc(chatRef, updates);
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  const renderStatus = (isOnline, lastSeen) => {
    if (otherUser.isGroup) return 'مجموعة';
    if (isOnline) return 'متصل الآن';
    if (lastSeen) {
      try {
        const date = typeof lastSeen === 'number' ? new Date(lastSeen) : (lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen));
        let timeStr = format(date, 'p', { locale: ar });
        if (!isToday(date)) {
          if (isYesterday(date)) timeStr = `أمس ${timeStr}`;
          else timeStr = `${format(date, 'dd/MM/yyyy')} ${timeStr}`;
        }
        return `آخر ظهور ${timeStr}`;
      } catch (e) { return 'غير متصل'; }
    }
    return 'غير متصل';
  };

  const formatDuration = (ms) => {
    const sec = Math.floor((ms / 1000) % 60);
    const min = Math.floor((ms / 1000 / 60) % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const renderMessage = ({ item }) => {
    if (item.deletedFor && item.deletedFor[user.uid]) return null;
    const isMine = item.senderId === user.uid;
    const time = item.createdAt ? (item.createdAt.toDate ? format(item.createdAt.toDate(), 'p', { locale: ar }) : '') : '';

    const renderTicks = () => {
      if (!isMine) return null;
      if (item.status === 'sent') return <Check size={14} color="rgba(233, 237, 239, 0.6)" />;
      return <CheckCheck size={14} color={item.status === 'seen' ? '#34B7F1' : 'rgba(233, 237, 239, 0.6)'} />;
    };

    return (
      <TouchableOpacity
        onLongPress={() => !item.isDeleted && setSelectedMessage(item)}
        activeOpacity={0.8}
        style={[styles.messageWrapper, isMine ? styles.myMessageWrapper : styles.theirMessageWrapper]}
      >
        <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.theirBubble, item.isDeleted && styles.deletedBubble]}>
          {item.replyTo && (
            <View style={styles.replyPreviewInside}>
              <Text style={styles.replyNameInside} numberOfLines={1}>
                {item.replyTo.senderId === user.uid ? 'أنت' : otherUser.displayName}
              </Text>
              <Text style={styles.replyTextInside} numberOfLines={1}>{item.replyTo.text || (item.replyTo.audioUrl ? 'رسالة صوتية' : 'صورة')}</Text>
            </View>
          )}
          {item.imageUrl && !item.isDeleted && <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />}
          {item.audioUrl && !item.isDeleted && (
            <View style={styles.audioContainer}>
              <TouchableOpacity onPress={() => playPauseAudio(item.id, item.audioUrl)}>
                {playingId === item.id ? <Pause size={24} color={theme.colors.text} /> : <Play size={24} color={theme.colors.text} />}
              </TouchableOpacity>
              <View style={styles.audioProgress} />
              <Text style={styles.audioDuration}>{formatDuration(item.audioDuration)}</Text>
            </View>
          )}
          {item.text ? <Text style={[styles.messageText, item.isDeleted && styles.deletedText]}>{item.text}</Text> : null}
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{time}</Text>
            {isMine && !item.isDeleted && <View style={styles.statusIcon}>{renderTicks()}</View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><ChevronRight size={28} color={theme.colors.text} /></TouchableOpacity>
        <TouchableOpacity style={styles.headerUser} activeOpacity={0.7}>
          <View style={styles.headerInfo}>
            <Text style={styles.userName}>{otherUser.displayName}</Text>
            <Text style={[styles.userStatus, otherUserStatus.isOnline && { color: theme.colors.primary }]}>{renderStatus(otherUserStatus.isOnline, otherUserStatus.lastSeen)}</Text>
          </View>
          <Image source={{ uri: otherUser.photoURL }} style={styles.headerAvatar} />
        </TouchableOpacity>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIcon}><Video size={22} color={theme.colors.text} /></TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}><Phone size={22} color={theme.colors.text} /></TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setMenuVisible(true)}><MoreVertical size={22} color={theme.colors.text} /></TouchableOpacity>
        </View>
      </View>

      <ImageBackground source={{ uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' }} style={styles.chatBackground} imageStyle={{ opacity: 0.05 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} style={{ flex: 1 }}>
          <FlatList ref={flatListRef} data={messages} keyExtractor={item => item.id} renderItem={renderMessage} contentContainerStyle={styles.messagesList} onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })} />

          {replyTo && (
            <View style={styles.replyContainer}>
              <View style={styles.replyInfo}>
                <Text style={styles.replyName}>{replyTo.senderId === user.uid ? 'أنت' : otherUser.displayName}</Text>
                <Text style={styles.replyText} numberOfLines={1}>{replyTo.text || (replyTo.audioUrl ? 'رسالة صوتية' : 'صورة')}</Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)}><X size={20} color={theme.colors.textSecondary} /></TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TouchableOpacity style={[styles.sendButton, isRecording && { backgroundColor: theme.colors.error }]} onPress={() => inputText.trim() ? sendMessage() : (isRecording ? stopRecording() : startRecording())} activeOpacity={0.8}>
              {inputText.trim() ? <Send size={24} color={theme.colors.white} /> : <Mic size={24} color={theme.colors.white} />}
            </TouchableOpacity>

            <View style={styles.textInputContainer}>
              <TouchableOpacity onPress={pickImage}><Paperclip size={24} color={theme.colors.textSecondary} style={styles.inputIcon} /></TouchableOpacity>
              <TextInput style={styles.input} placeholder={isRecording ? "جاري التسجيل..." : "الرسالة"} placeholderTextColor={theme.colors.textSecondary} value={inputText} onChangeText={setInputText} multiline blurOnSubmit={false} editable={!isRecording} />
              <TouchableOpacity><Smile size={24} color={theme.colors.textSecondary} style={styles.inputIcon} /></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>

      <Modal visible={!!selectedMessage} transparent={true} animationType="fade" onRequestClose={() => setSelectedMessage(null)}>
        <TouchableWithoutFeedback onPress={() => setSelectedMessage(null)}>
          <View style={styles.menuOverlay}>
            <View style={styles.menuContent}>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setReplyTo(selectedMessage); setSelectedMessage(null); }}><Text style={styles.menuText}>الرد</Text></TouchableOpacity>
              {selectedMessage?.senderId === user.uid && <TouchableOpacity style={styles.menuItem} onPress={() => deleteMessage(selectedMessage.id, true)}><Text style={[styles.menuText, { color: theme.colors.error }]}>الحذف لدى الجميع</Text></TouchableOpacity>}
              <TouchableOpacity style={styles.menuItem} onPress={() => deleteMessage(selectedMessage.id, false)}><Text style={[styles.menuText, { color: theme.colors.error }]}>الحذف لدي</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={menuVisible} transparent={true} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <View style={styles.menuContent}>
              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}><UserIcon size={20} color={theme.colors.text} /><Text style={styles.menuText}>عرض الملف الشخصي</Text></TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={clearChat}><Trash2 size={20} color={theme.colors.error} /><Text style={[styles.menuText, { color: theme.colors.error }]}>مسح الدردشة</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { height: 60, backgroundColor: theme.colors.surface, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 10, marginTop: Platform.OS === 'ios' ? 40 : 0, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border },
  backBtn: { padding: 5 },
  headerUser: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 5 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginLeft: 10 },
  headerInfo: { alignItems: 'flex-end' },
  userName: { color: theme.colors.text, fontSize: 16, fontWeight: 'bold' },
  userStatus: { color: theme.colors.textSecondary, fontSize: 12 },
  headerIcons: { flexDirection: 'row' },
  headerIcon: { marginLeft: 15 },
  chatBackground: { flex: 1, backgroundColor: '#0B141B' },
  messagesList: { padding: 12, paddingBottom: 20 },
  messageWrapper: { marginBottom: 4, width: '100%' },
  myMessageWrapper: { alignItems: 'flex-end' },
  theirMessageWrapper: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: '85%', padding: 8, borderRadius: 12, position: 'relative', elevation: 1 },
  myBubble: { backgroundColor: theme.colors.bubbleSelf, borderTopRightRadius: 2 },
  theirBubble: { backgroundColor: theme.colors.bubbleOther, borderTopLeftRadius: 2 },
  messageText: { color: theme.colors.text, fontSize: 16, textAlign: 'right', lineHeight: 22 },
  messageImage: { width: 240, height: 240, borderRadius: 8, marginBottom: 5 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
  messageTime: { fontSize: 11, color: 'rgba(233, 237, 239, 0.6)' },
  statusIcon: { marginLeft: 4 },
  inputContainer: { flexDirection: 'row-reverse', padding: 8, alignItems: 'flex-end', backgroundColor: 'transparent' },
  textInputContainer: { flex: 1, flexDirection: 'row-reverse', backgroundColor: theme.colors.surface, borderRadius: 25, paddingHorizontal: 12, alignItems: 'center', minHeight: 48 },
  input: { flex: 1, color: theme.colors.text, fontSize: 16, maxHeight: 120, textAlign: 'right', paddingVertical: 8, paddingHorizontal: 8 },
  inputIcon: { marginHorizontal: 4 },
  sendButton: { backgroundColor: theme.colors.primary, width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  menuContent: { backgroundColor: theme.colors.surface, borderRadius: 8, padding: 8, minWidth: 200, elevation: 5 },
  menuItem: { flexDirection: 'row-reverse', alignItems: 'center', padding: 12 },
  menuText: { color: theme.colors.text, fontSize: 16, marginRight: 12 },
  deletedBubble: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.2)' },
  deletedText: { color: theme.colors.textSecondary, fontStyle: 'italic', fontSize: 14 },
  replyContainer: { flexDirection: 'row-reverse', backgroundColor: theme.colors.surface, padding: 10, borderTopLeftRadius: 15, borderTopRightRadius: 15, marginHorizontal: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  replyInfo: { flex: 1, borderRightWidth: 4, borderRightColor: theme.colors.primary, paddingRight: 10, alignItems: 'flex-end' },
  replyName: { color: theme.colors.primary, fontWeight: 'bold', fontSize: 13 },
  replyText: { color: theme.colors.textSecondary, fontSize: 14 },
  replyPreviewInside: { backgroundColor: 'rgba(0,0,0,0.1)', borderRightWidth: 3, borderRightColor: theme.colors.primary, padding: 5, marginBottom: 5, borderRadius: 4, alignItems: 'flex-end' },
  replyNameInside: { color: theme.colors.primary, fontSize: 12, fontWeight: 'bold' },
  replyTextInside: { color: theme.colors.textSecondary, fontSize: 12 },
  audioContainer: { flexDirection: 'row-reverse', alignItems: 'center', padding: 5, minWidth: 200 },
  audioProgress: { flex: 1, height: 2, backgroundColor: theme.colors.border, marginHorizontal: 10 },
  audioDuration: { color: theme.colors.text, fontSize: 12 }
});
