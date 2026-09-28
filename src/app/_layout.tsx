// src/app/_layout.tsx
//
// Stack na raiz: permite empilhar telas (cadastro-cliente, etc.) por cima
// das abas. O grupo (tabs) é a primeira tela do Stack, sem cabeçalho
// próprio porque o NativeTabs já cuida da sua própria barra.
//
// O AuthProvider envolve tudo, e o componente Navegacao aplica a proteção
// de rotas: sem login, só as telas do grupo (auth) ficam acessíveis.

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AuthProvider, useProtecaoDeRotas } from '@/auth/AuthContext';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useSincronizacaoAutomatica } from '../sync/useSincronizacaoAutomatica';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useSincronizacaoAutomatica();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Navegacao />
      </ThemeProvider>
    </AuthProvider>
  );
}

// Fica em um componente separado porque o useProtecaoDeRotas usa o useAuth,
// que só funciona DENTRO do AuthProvider.
function Navegacao() {
  useProtecaoDeRotas();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      
      <Stack.Screen name="(interno)/clientes/novo" options={{ headerShown: true, title: 'Novo cliente' }} />
    </Stack>
  );
}
