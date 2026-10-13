# Visuels du site

## Visuel principal

- Mode : outil intégré **Imagegen**, génération d’une nouvelle image.
- Fichier utilisé : `Frondend/public/images/hero-classroom.jpg`.
- Source conservée : `Frondend/assets/hero-classroom-source.png`.
- Rôle : illustration d’un groupe fictif d’apprenants. Ce visuel ne représente pas les locaux ou les étudiants réels du centre.

Prompt final :

```text
Use case: photorealistic-natural. Asset type: professional education website hero photograph, landscape 3:2. Primary request: warm candid editorial photograph of four young adult East African learners, both men and women, working together around a laptop in a contemporary bright training classroom in Djibouti. A woman in a tasteful pale beige hijab in the foreground, another smiling woman with natural dark curls, two young men in clean casual shirts. Authentic engaged expressions, looking at each other or the laptop, natural hands, notebooks, wood desk, soft window light, subtle green plants, navy and cream palette. Composition: medium-wide eye-level photograph, subjects filling frame with room above heads, enough scene for rounded rectangular website crop. Style: premium documentary education photography, realistic skin and texture, 35mm lens, understated warm film grain. Constraints: no text, no logos, no watermark, no graphic overlays, no graduation gowns. This is illustrative fictional training imagery, not documentation of an actual institution.
```

## Illustrations des formations

Les photographies illustratives téléchargées depuis Unsplash sont stockées localement. Elles ne représentent pas des locaux ou formateurs attestés du centre.

| Fichier            | Source téléchargée                                           |
| ------------------ | ------------------------------------------------------------ |
| `langues.jpg`      | https://images.unsplash.com/photo-1434030216411-0b793f4b4173 |
| `informatique.jpg` | https://images.unsplash.com/photo-1516321318423-f06f85e504b3 |
| `management.jpg`   | https://images.unsplash.com/photo-1522071820081-009f0129c71c |
| `finance.jpg`      | https://images.unsplash.com/photo-1460925895917-afdab827c52f |
| `centre.jpg`       | https://images.unsplash.com/photo-1523240795612-9a054b0db644 |

## Logo et typographie

Le fichier original fourni est conservé dans `Frondend/public/Untitled-2.png`. Le composant `Frondend/src/components/Brand.jsx` affiche son symbole avec un cadrage SVG sans modifier l’image, accompagné d’une signature horizontale adaptée à la navigation. Le favicon `faviconn.svg` reprend les couleurs de l’identité.

DM Sans et Manrope sont téléchargées depuis Google Fonts et servies depuis `Frondend/public/fonts`. Le site ne charge pas Google Fonts au démarrage.
