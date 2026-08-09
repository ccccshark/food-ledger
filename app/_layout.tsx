import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';
import { useAppFonts } from '@/constants/fonts';
import { DialogHost } from '@/components/DialogHost';

export default function RootLayout() {
  const { ready } = useAppFonts();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.paper, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.stamp} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.paper },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add"
          options={{ presentation: 'modal', title: '记一笔', headerShown: false }}
        />
        <Stack.Screen
          name="ai-settings"
          options={{ presentation: 'card', title: 'AI 设置', headerShown: false }}
        />
        <Stack.Screen
          name="share"
          options={{ presentation: 'modal', title: '分享', headerShown: false }}
        />
      </Stack>
      <DialogHost />
    </>
  );
}
