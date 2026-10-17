/** Jest stand-in for expo-location. */
export const Accuracy = { High: 4 };
export async function getForegroundPermissionsAsync() {
  return { status: 'denied' };
}
export async function getLastKnownPositionAsync() {
  return null;
}
export async function getCurrentPositionAsync() {
  throw new Error('no location in tests');
}
export async function reverseGeocodeAsync() {
  return [];
}
export function useForegroundPermissions() {
  return [null, async () => ({ status: 'denied' })];
}
