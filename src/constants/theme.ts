/**
 * Crew Lens palette: black and white, warm off-white canvas, one red for warnings.
 * Black is the action colour (buttons, selected chips, the camera button). Red only ever
 * means something needs attention: unsynced, failed, destructive, recording.
 */
export const Colors = {
  canvas: '#F5F4F1',
  surface: '#FFFFFF',
  ink: '#22211E',
  ink2: '#6E6C67',
  hairline: '#E4E2DD',
  /** Action colour: primary buttons, selected state, camera button. Black. */
  flag: '#22211E',
  /** Warnings only: unsynced, failed, destructive, recording. */
  danger: '#D92D20',
  /** Data colour: stamps, links, secondary text on data. */
  slate: '#4A4945',
  ok: '#1F8A4C',
  camera: '#0B0B0D',
  onCamera: '#FFFFFF',
} as const;

export const Space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
/** Big soft corners and pill buttons, like a modern field app. */
export const Radius = { chip: 10, card: 20, field: 18, pill: 999, round: 999 } as const;

export const Fonts = {
  heading: 'Figtree_600SemiBold',
  headingBold: 'Figtree_800ExtraBold',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_600SemiBold',
  /** Labels and counters. */
  label: 'Figtree_500Medium',
  labelBold: 'Figtree_700Bold',
  /** The evidence stamp keeps a monospace face: it is the product's signature. */
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;
