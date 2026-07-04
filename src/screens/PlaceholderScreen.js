import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Header from '../components/Header';
import { theme } from '../theme';

export default function PlaceholderScreen({ title }) {
  return (
    <View style={styles.container}>
      <Header title="هش" />
      <View style={styles.content}>
        <Text style={styles.text}>{title}</Text>
        <Text style={styles.subtext}>قريباً في التحديث القادم</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  subtext: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 10,
  }
});
