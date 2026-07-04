import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Platform } from 'react-native';
import { theme } from '../theme';
import { Camera, Search, MoreVertical } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

export default function Header({ title }) {
  const navigation = useNavigation();

  return (
    <View style={styles.wrapper}>
      {Platform.OS === 'ios' && (
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <View style={styles.container}>
        <View style={styles.leftSection}>
          <Text style={styles.logoText}>{title || 'هش'}</Text>
        </View>
        <View style={styles.rightSection}>
          <TouchableOpacity style={styles.iconButton}>
            <Camera size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Search')}>
            <Search size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Settings')}>
            <MoreVertical size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 60,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border,
  },
  container: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
  },
  leftSection: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginRight: 10,
  },
  rightSection: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 20,
  }
});
