import { LogBox } from 'react-native'

/**
 * Keeps three warnings about push notifications out of the in-app log banner.
 *
 * `expo-notifications` warns, the moment it is imported in Expo Go, that its push features
 * are not available there — three messages, each matched by its opening words, taken from
 * the library's build rather than its source, which words them differently. This app uses
 * no push: its reminders are local notifications (D-013), which Expo Go does support. The
 * warnings were measured on 2026-11-07 on the Android emulator, where their banner sat at
 * the bottom of the screen over Home's reminders button and took the tap meant for it.
 *
 * Hidden from the banner only; they still reach Metro's console. Imported first by the
 * root layout, because the library warns at import time and a filter registered after the
 * warning has no effect on it.
 */
LogBox.ignoreLogs([
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go',
  '[expo-notifications] Push notifications (remote notifications) are unavailable in Expo Go',
])
