export { clearClipboardLater, copySecret, CLEAR_CLIPBOARD_MS } from './clipboard'
export { LockedNoteCard, UnlockedBand } from './components/LockedNoteCard'
export { PrivateProvider } from './components/PrivateProvider'
export { PrivateSection } from './components/PrivateSection'
export { LOST_NOTE, NEEDS_CONNECTION, tryDeviceLabel, WRONG_KEY } from './copy'
export {
  openNote,
  rememberOpenedNote,
  sealNote,
  useIsLostNote,
  useOpenedNote,
  type OpenedNote,
  type SealedNotes,
} from './notes'
export {
  useOptionalPrivate,
  usePrivate,
  usePrivateKeyId,
  type PrivateContextValue,
} from './privateContext'
export { getUnlocked, lock, UNLOCK_MS, useUnlocked, type Unlocked } from './unlock'
