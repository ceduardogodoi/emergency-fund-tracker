import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from '@expo-google-fonts/archivo'

import { fontFamily } from '@/ui/tokens'

/**
 * The font files behind {@link fontFamily}, in the shape `useFonts` takes.
 *
 * Keyed by the token rather than by a repeated string literal: the key is the name React
 * Native resolves `fontFamily` against, so a typo here would not fail to compile — it
 * would silently fall back to the system face on one weight, which is the kind of defect
 * that ships because it still looks like text.
 *
 * The files are bundled with the app. Nothing is fetched at runtime, which is what keeps
 * a typeface compatible with FR-041's offline guarantee.
 */
export const FONTS = {
  [fontFamily.regular]: Archivo_400Regular,
  [fontFamily.medium]: Archivo_500Medium,
  [fontFamily.semibold]: Archivo_600SemiBold,
  [fontFamily.bold]: Archivo_700Bold,
}
