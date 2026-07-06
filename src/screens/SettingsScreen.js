import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import {
  User,
  Bell,
  Lock,
  HelpCircle,
  LogOut,
  ChevronLeft,
  Camera,
  Languages,
  ShieldCheck,
  CircleHelp,
  Check,
  X
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';

export default function SettingsScreen() {
  const { profile, logout, updateProfile } = useAuth();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(profile?.displayName || '');
  const [editStatus, setEditStatus] = useState(profile?.status || '');
  const [updating, setUpdating] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      uploadProfileImage(result.assets[0].uri);
    }
  };

  const uploadProfileImage = async (uri) => {
    setUpdating(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `profiles/${profile.uid}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      await updateProfile({ photoURL: downloadURL });
      Alert.alert('نجاح', 'تم تحديث الصورة الشخصية');
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert('خطأ', 'فشل تحديث الصورة');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('تنبيه', 'لا يمكن أن يكون الاسم فارغاً');
      return;
    }

    setUpdating(true);
    try {
      await updateProfile({
        displayName: editName.trim(),
        status: editStatus.trim()
      });
      setIsEditingProfile(false);
      Alert.alert('نجاح', 'تم تحديث البيانات');
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث البيانات');
    } finally {
      setUpdating(false);
    }
  };

  const SettingItem = ({ icon: Icon, title, subtitle, onPress, color = theme.colors.textSecondary, showChevron = true }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingIconContainer}>
        <Icon size={24} color={color} />
      </View>
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showChevron && <ChevronLeft size={20} color={theme.colors.textSecondary} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Profile Header */}
        <TouchableOpacity style={styles.profileHeader} onPress={() => setIsEditingProfile(true)}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: profile?.photoURL }} style={styles.avatar} />
            <TouchableOpacity style={styles.cameraBtn} onPress={handlePickImage} disabled={updating}>
              {updating ? <ActivityIndicator size="small" color={theme.colors.white} /> : <Camera size={20} color={theme.colors.white} />}
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{profile?.displayName}</Text>
            <Text style={styles.username}>@{profile?.username}</Text>
            <Text style={styles.status} numberOfLines={1}>{profile?.status}</Text>
          </View>
        </TouchableOpacity>

        {/* Edit Profile Modal */}
        <Modal
          visible={isEditingProfile}
          animationType="slide"
          onRequestClose={() => setIsEditingProfile(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsEditingProfile(false)}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تعديل الملف الشخصي</Text>
              <TouchableOpacity onPress={handleUpdateProfile} disabled={updating}>
                {updating ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Check size={24} color={theme.colors.primary} />}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.editAvatarSection}>
                <Image source={{ uri: profile?.photoURL }} style={styles.largeAvatar} />
                <TouchableOpacity style={styles.editAvatarBtn} onPress={handlePickImage}>
                  <Camera size={24} color={theme.colors.white} />
                  <Text style={styles.editAvatarText}>تغيير الصورة</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>الاسم</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="أدخل اسمك"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>
                <Text style={styles.inputHint}>هذا ليس اسم المستخدم الخاص بك. هذا الاسم سيظهر لجهات اتصالك في هش.</Text>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>الأخبار</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    value={editStatus}
                    onChangeText={setEditStatus}
                    placeholder="الحالة"
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>

        <View style={styles.section}>
          <SettingItem
            icon={User}
            title="الحساب"
            subtitle="الخصوصية، الأمان، تغيير الرقم"
          />
          <SettingItem
            icon={Lock}
            title="الخصوصية"
            subtitle="آخر ظهور، صورة الملف الشخصي"
          />
          <SettingItem
            icon={Bell}
            title="الإشعارات"
            subtitle="نغمات الرسائل، المجموعات"
          />
          <SettingItem
            icon={ShieldCheck}
            title="الأمان"
            subtitle="التحقق بخطوتين، تشفير الرسائل"
          />
          <SettingItem
            icon={Languages}
            title="لغة التطبيق"
            subtitle="العربية (لغة النظام)"
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            icon={CircleHelp}
            title="المساعدة"
            subtitle="مركز المساعدة، اتصل بنا، سياسة الخصوصية"
          />
          <SettingItem
            icon={LogOut}
            title="تسجيل الخروج"
            color={theme.colors.error}
            showChevron={false}
            onPress={logout}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>من</Text>
          <Text style={styles.footerBrand}>Hash Team</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  profileHeader: {
    flexDirection: 'row-reverse',
    padding: 20,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  profileInfo: {
    flex: 1,
    marginRight: 20,
    alignItems: 'flex-end',
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  username: {
    fontSize: 14,
    color: theme.colors.primary,
    marginTop: 2,
  },
  status: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  section: {
    backgroundColor: theme.colors.surface,
    marginBottom: 20,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: theme.colors.border,
  },
  settingItem: {
    flexDirection: 'row-reverse',
    padding: 15,
    alignItems: 'center',
  },
  settingIconContainer: {
    width: 40,
    alignItems: 'center',
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 15,
    alignItems: 'flex-end',
  },
  settingTitle: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  footerBrand: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  editAvatarSection: {
    alignItems: 'center',
    marginVertical: 30,
  },
  largeAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 15,
  },
  editAvatarBtn: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  editAvatarText: {
    color: theme.colors.white,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  inputSection: {
    marginBottom: 25,
  },
  inputLabel: {
    color: theme.colors.primary,
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'right',
  },
  inputWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary,
    paddingBottom: 5,
  },
  textInput: {
    color: theme.colors.text,
    fontSize: 16,
    textAlign: 'right',
  },
  inputHint: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  }
});
