# New catalog sprite assets

Built-in image generation was used for the 31 new catalog entries. Existing 24 PNGs were reused byte for byte. Generated atlases were sliced into cells, isolated by alpha-connected foreground, padded to 192x192 and quantized to 128 colors for the MiniGame package. Each final asset has transparent margins and is below 200KB.

Prompt set: production photorealistic full-body pet-cat atlases on transparent RGBA; no labels, props or dividers; regular four-column grid; each breed paired as awake seated three-quarter view and curled sleeping side view; full ears, paws and tail within the cell. Soft studio light, realistic distinctive anatomy. Row order and breed-specific coat/anatomy descriptions follow the 40-entry cat-breeds.js catalog.

Atlas A (4x8): exotic/oriental; abyssinian/bombay; snowshoe/singapura; burmese/burmilla; havana/chinchilla; himalayan/norwegian; siberian/angora; somali/balinese.
Atlas B (4x8): tiffanie/turkish-van; devon-rex/cornish-rex; selkirk-rex/laperm; sphynx/peterbald; lykoi/scottish-fold; american-curl/munchkin; minuet/manx; japanese-bobtail/unused alternative.
Correction atlas (4x2): tiffanie/exotic; american-curl/japanese-bobtail. Prompt emphasized solid sable semilong coat, flat Persian-like Exotic nose, unmistakably backward-curling ears, and tiny rabbit-like bobtail, respectively. These four new entries use the corrected asset pair.

Only new entries were generated. Founder images and the original breed/coat images were not regenerated. Breed names and appearance notes were checked against CFA/TICA resources; game catalog entries are not pedigree certification.
Reference: https://cfa.org/breeds/ and https://tica.org/resources/our-publications/breed-standards
