// src/app/_layout.tsx
//
// Agora é um Stack na raiz - isso é o que permite empilhar telas
// (cadastro-cliente, etc.) por cima das abas. O grupo (tabs) vira a
// primeira tela do Stack, sem cabeçalho próprio (headerShown: false)
// porque o NativeTabs já cuida da sua própria barra.

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useSincronizacaoAutomatica } from '../sync/useSincronizacaoAutomatica';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useSincronizacaoAutomatica();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cadastro-cliente" options={{ headerShown: true, title: 'Novo cadastro' }} />
        <Stack.Screen name="(interno)/clientes/novo" options={{ headerShown: true, title: 'Novo cliente' }} />
      </Stack>
    </ThemeProvider>
  );
}