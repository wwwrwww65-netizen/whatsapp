import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { Search, Camera, MoreVertical } from 'lucide-react-native';
import { theme } from '../theme';
import { useNavigation } from '@react-navigation/native';

export default function Header({ title }) {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.leftIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Camera size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Search')}
          >
            <Search size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <MoreVertical size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.surface,
  },
  container: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: Platform.OS === 'android' ? 30 : 0,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  leftIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 20,
  }
});
