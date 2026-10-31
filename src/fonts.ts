// Free handwritten fonts that work well for labels. All use the SIL Open Font License.
// The library does not ship font files. Install the package and import it on your page,
// for example `import '@fontsource/rock-salt'`. The CLI finds installed packages by itself.

export interface FontInfo {
  /** Short name. */
  name: string;
  /** Value for `font.family` in a style. */
  family: string;
  /** npm package with the font files. */
  package: string;
  /** Weight to use. */
  weight: number;
  /** Good label size in pixels. Some fonts are small for their size. */
  size: number;
  /** How it looks, in a few words. */
  look: string;
}

export const fonts: FontInfo[] = [
  { name: 'Permanent Marker', family: '"Permanent Marker", cursive', package: '@fontsource/permanent-marker', weight: 400, size: 34, look: 'Thick felt marker. The default.' },
  { name: 'Caveat', family: '"Caveat Variable", Caveat, cursive', package: '@fontsource-variable/caveat', weight: 600, size: 40, look: 'Quick, neat handwriting.' },
  { name: 'Caveat Brush', family: '"Caveat Brush", cursive', package: '@fontsource/caveat-brush', weight: 400, size: 40, look: 'Brush pen, a bit bolder than Caveat.' },
  { name: 'Kalam', family: 'Kalam, cursive', package: '@fontsource/kalam', weight: 700, size: 34, look: 'Whiteboard marker.' },
  { name: 'Patrick Hand', family: '"Patrick Hand", cursive', package: '@fontsource/patrick-hand', weight: 400, size: 36, look: 'Clean print handwriting.' },
  { name: 'Gochi Hand', family: '"Gochi Hand", cursive', package: '@fontsource/gochi-hand', weight: 400, size: 36, look: 'Round, friendly marker.' },
  { name: 'Shadows Into Light', family: '"Shadows Into Light", cursive', package: '@fontsource/shadows-into-light', weight: 400, size: 38, look: 'Thin pencil.' },
  { name: 'Reenie Beanie', family: '"Reenie Beanie", cursive', package: '@fontsource/reenie-beanie', weight: 400, size: 46, look: 'Loose ballpoint scrawl.' },
  { name: 'Rock Salt', family: '"Rock Salt", cursive', package: '@fontsource/rock-salt', weight: 400, size: 26, look: 'Rough, energetic marker. Wide.' },
  { name: 'Gloria Hallelujah', family: '"Gloria Hallelujah", cursive', package: '@fontsource/gloria-hallelujah', weight: 400, size: 30, look: 'Playful notebook writing.' },
  { name: 'Architects Daughter', family: '"Architects Daughter", cursive', package: '@fontsource/architects-daughter', weight: 400, size: 32, look: 'Neat technical lettering.' },
  { name: 'Cabin Sketch', family: '"Cabin Sketch", cursive', package: '@fontsource/cabin-sketch', weight: 700, size: 34, look: 'Hatched chalk letters.' },
  { name: 'Covered By Your Grace', family: '"Covered By Your Grace", cursive', package: '@fontsource/covered-by-your-grace', weight: 400, size: 40, look: 'Tall, bold felt pen.' },
  { name: 'Nanum Pen Script', family: '"Nanum Pen Script", cursive', package: '@fontsource/nanum-pen-script', weight: 400, size: 46, look: 'Fine pen, narrow.' },
  { name: 'Indie Flower', family: '"Indie Flower", cursive', package: '@fontsource/indie-flower', weight: 400, size: 34, look: 'Soft, round handwriting.' },
  { name: 'Sedgwick Ave', family: '"Sedgwick Ave", cursive', package: '@fontsource/sedgwick-ave', weight: 400, size: 36, look: 'Graffiti marker.' },
  { name: 'Just Another Hand', family: '"Just Another Hand", cursive', package: '@fontsource/just-another-hand', weight: 400, size: 48, look: 'Tall, narrow capitals.' },
  { name: 'Schoolbell', family: 'Schoolbell, cursive', package: '@fontsource/schoolbell', weight: 400, size: 34, look: 'School chalkboard.' },
  { name: 'Bangers', family: 'Bangers, cursive', package: '@fontsource/bangers', weight: 400, size: 38, look: 'Comic book capitals.' },
];
