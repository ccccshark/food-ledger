import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';
import { useAppFonts } from '@/constants/fonts';
import { DialogHost } from '@/components/DialogHost';
import { useT } from '@/constants/i18n';
import { useI18nStore } from '@/stores/i18n';

export default function RootLayout() {
  const { ready } = useAppFonts();
  const { t } = useT();

  useEffect(() => {
    useI18nStore.getState().init();
  }, []);

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
          options={{ presentation: 'modal', title: t('root.add'), headerShown: false }}
        />
        <Stack.Screen
          name="ai-settings"
          options={{ presentation: 'card', title: t('root.ai_settings'), headerShown: false }}
        />
        <Stack.Screen
          name="share"
          options={{ presentation: 'modal', title: t('root.share'), headerShown: false }}
        />
      </Stack>
      <DialogHost />
    </>
  );
}
