import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch } from 'react-native';
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
  CircleHelp
} from 'lucide-react-native';

export default function SettingsScreen() {
  const { profile, logout } = useAuth();

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
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: profile?.photoURL }} style={styles.avatar} />
            <TouchableOpacity style={styles.cameraBtn}>
              <Camera size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{profile?.displayName}</Text>
            <Text style={styles.username}>@{profile?.username}</Text>
            <Text style={styles.status} numberOfLines={1}>{profile?.status}</Text>
          </View>
        </View>

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
  }
});
