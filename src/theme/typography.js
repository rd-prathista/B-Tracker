/**
 * B Tracker — Typography System
 * Using Inter font family for premium consistency across all Android devices.
 */

export const fonts = {
  regular: 'Inter_400Regular',
  medium:  'Inter_500Medium',
  semiBold:'Inter_600SemiBold',
  bold:    'Inter_700Bold',
  extraBold:'Inter_800ExtraBold',
};

export const typography = {
  // Headings
  h1: { fontFamily: 'Inter_800ExtraBold', fontSize: 26, letterSpacing: -0.3, color: '#F8FAFC' },
  h2: { fontFamily: 'Inter_700Bold',      fontSize: 20, letterSpacing: -0.2, color: '#F8FAFC' },
  h3: { fontFamily: 'Inter_700Bold',      fontSize: 17, color: '#F8FAFC' },

  // Screen Title
  screenTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 24, letterSpacing: -0.5, color: '#F8FAFC' },

  // Body
  body:        { fontFamily: 'Inter_400Regular',  fontSize: 15, color: '#F8FAFC' },
  bodySmall:   { fontFamily: 'Inter_400Regular',  fontSize: 13, color: '#94A3B8' },
  bodyMedium:  { fontFamily: 'Inter_500Medium',   fontSize: 14, color: '#F8FAFC' },

  // Labels
  label:       { fontFamily: 'Inter_700Bold',     fontSize: 11, letterSpacing: 1.0, color: '#64748B' },
  caption:     { fontFamily: 'Inter_400Regular',  fontSize: 11, color: '#64748B' },

  // Numeric / Finance values
  balanceLarge:  { fontFamily: 'Inter_800ExtraBold', fontSize: 32, letterSpacing: -1,   color: '#F8FAFC' },
  balanceMedium: { fontFamily: 'Inter_700Bold',      fontSize: 20, letterSpacing: -0.5, color: '#F8FAFC' },
  balanceSmall:  { fontFamily: 'Inter_700Bold',      fontSize: 14, color: '#F8FAFC' },
  amountInput:   { fontFamily: 'Inter_800ExtraBold', fontSize: 46, letterSpacing: -1.5 },

  // Buttons
  buttonPrimary:   { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#FFFFFF', letterSpacing: 0.3 },
  buttonSecondary: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#94A3B8' },

  // Transaction
  txCategory: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#F8FAFC' },
  txMeta:     { fontFamily: 'Inter_400Regular',  fontSize: 11, color: '#64748B' },
  txAmount:   { fontFamily: 'Inter_700Bold',     fontSize: 13 },

  // Section labels / subheadings
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.2, color: '#64748B' },

  // Input
  inputText:        { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#F8FAFC' },
  inputPlaceholder: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#64748B' },
};
