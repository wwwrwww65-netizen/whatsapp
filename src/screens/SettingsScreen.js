import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { theme } from '../theme';
import { User, Lock, MessageCircle, Bell, Database, HelpCircle, LogOut } from 'lucide-react-native';
import { auth } from '../services/firebase';

export default function SettingsScreen() {
  const { profile } = useAuth();

  const handleLogout = () => {
    auth.signOut();
  };

  const SettingItem = ({ icon: Icon, title, subtitle, color }) => (
    <TouchableOpacity style={styles.item}>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{title}</Text>
        {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.iconContainer}>
        <Icon size={24} color={color || theme.colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.profileSection}>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profile?.displayName}</Text>
          <Text style={styles.profileStatus}>{profile?.status}</Text>
        </View>
        <Image source={{ uri: profile?.photoURL }} style={styles.profileAvatar} />
      </TouchableOpacity>

      <View style={styles.divider} />

      <SettingItem icon={User} title="الحساب" subtitle="الخصوصية، الأمان، تغيير الرقم" />
      <SettingItem icon={Lock} title="الخصوصية" subtitle="آخر ظهور، الصورة الشخصية" />
      <SettingItem icon={MessageCircle} title="الدردشات" subtitle="المظهر، الخلفيات، سجل الدردشات" />
      <SettingItem icon={Bell} title="الإشعارات" subtitle="نغمات الرسائل والمجموعات" />
      <SettingItem icon={Database} title="التخزين والبيانات" subtitle="استخدام الشبكة، التنزيل التلقائي" />
      <SettingItem icon={HelpCircle} title="المساعدة" subtitle="مركز المساعدة، اتصل بنا، سياسة الخصوصية" />

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
        <LogOut size={24} color={theme.colors.error} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  profileSection: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginLeft: 15,
  },
  profileInfo: {
    alignItems: 'flex-end',
  },
  profileName: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileStatus: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  divider: {
    height: 0.5,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
  item: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconContainer: {
    width: 40,
    alignItems: 'center',
    marginLeft: 15,
  },
  itemContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemTitle: {
    color: theme.colors.text,
    fontSize: 16,
  },
  itemSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  logoutButton: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  logoutText: {
    color: theme.colors.error,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 15,
  }
});
