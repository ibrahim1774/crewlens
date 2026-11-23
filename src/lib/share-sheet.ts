import { Share, type ShareContent } from 'react-native';

/** Our bottom Sheet is a React Native Modal that slides out in about this long. */
export const SHEET_CLOSE_MS = 450;

/**
 * Opens the iOS share sheet without tying any button's busy state to it.
 *
 * Share.share's promise only settles when iOS reports the sheet closed. If the sheet is presented
 * while one of our Sheet modals is still sliding away, iOS drops it and the promise never settles.
 * Awaiting it inside a busy flag left that flag on for good: the gallery "Share N photos" button
 * spun forever after a live link, until the app restarted. Callers create and copy the link first,
 * clear busy, then call this. Pass afterSheetClose when a Sheet was just closed.
 */
export function presentShare(content: ShareContent, afterSheetClose = false): void {
  const open = () => {
    Share.share(content).catch(() => {});
  };
  if (afterSheetClose) setTimeout(open, SHEET_CLOSE_MS);
  else open();
}
