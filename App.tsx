import "react-native-screens";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "./src/HomeScreen";
import TeleprompterScreen from "./src/TeleprompterScreen";
import type { RootStackParamList } from "./src/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={DarkTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: "#0f0a23" },
            headerTintColor: "#f5f3ff",
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: "800", letterSpacing: 0.3 },
            contentStyle: { backgroundColor: "#0a0a1f" },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: "CueLine" }}
          />
          <Stack.Screen
            name="Teleprompter"
            component={TeleprompterScreen}
            options={{ headerShown: false, orientation: "all" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
