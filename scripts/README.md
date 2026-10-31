# scripts

`vendor-fonts.js` saves Shippori Mincho B1 into `fonts/` so the games work offline (no Google Fonts at runtime). It keeps only the font slices whose characters appear in the app's text, so new Japanese text can need new slices. To refresh: delete `fonts/`, run

    node scripts/vendor-fonts.js . "https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@600;800&display=swap"

then put the printed file names (with a `fonts/` prefix) in `FONTS` in `sw.js` and bump `CACHE`.
