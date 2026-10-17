/** Crew Lens palette. One job per colour. See the design spec, section 3. */
export const Colors = {
  canvas: '#E9E7E1',
  surface: '#F7F6F2',
  ink: '#15161A',
  ink2: '#5B5E66',
  hairline: '#C9C7C0',
  /** The one action colour: capture button, primary CTA, unsynced badge. */
  flag: '#E8521E',
  /** Data colour: stamps, links, pins. */
  slate: '#3D5A80',
  ok: '#2F7D4F',
  camera: '#0B0B0D',
  onCamera: '#F7F6F2',
} as const;

export const Space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const Radius = { chip: 2, card: 6, round: 999 } as const;

export const Fonts = {
  heading: 'BarlowCondensed_600SemiBold',
  headingBold: 'BarlowCondensed_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;
