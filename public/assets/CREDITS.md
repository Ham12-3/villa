# Asset credits

All assets in this folder are CC0 (public domain) from Poly Haven, https://polyhaven.com

- hdri/belfast_sunset_puresky_1k.hdr: "Belfast Sunset (Pure Sky)", image-based lighting
- tex/sandstone_blocks_08_*: "Sandstone Blocks 08", stone base and paving
- tex/oak_veneer_01_*: "Oak Veneer 01", pergola timber
- tex/leafy_grass_*: "Leafy Grass", lawns and the meadow around the plot
- sky.jpg: "Belfast Sunset (Pure Sky)" again, the tone-mapped photo, as the visible sky
- models/mid_century_lounge_chair: "Mid Century Lounge Chair", living room and pool lounge
- models/modern_arm_chair_01: "Modern Arm Chair 01", bedroom and pool lounge
- models/dining_chair_02: "Dining Chair 02", dining room
- models/coffee_table_round_01: "Coffee Table Round 01", living room
- models/side_table_01: "Side Table 01", bedside and lounge tables
- models/ceramic_vase_01, models/ceramic_vase_02: "Ceramic Vase 01 / 02"
- models/potted_plant_02, models/potted_plant_04: "Potted Plant 02 / 04"

The .ktx2 files are GPU-compressed (Basis Universal) encodes of the original
1K JPGs, which live in /assets-src/tex. Re-encode with `npm run textures`.

The models are Poly Haven's glTF downloads with their textures resized to
512 px or 1K (`npm run models` fetches and resizes them). sky.jpg is resized
from the photo in /assets-src/sky with `npm run sky`.
