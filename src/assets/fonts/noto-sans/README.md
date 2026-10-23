# Invoice PDF fonts

Unmodified static Noto Sans Regular and Bold, downloaded from the archived upstream
repository on 2026-10-23:

- https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans
- License and copyright: LICENSE in this directory, SIL Open Font License 1.1.

Vite embeds these local files via `?inline`. Invoice generation does not request a
font service. jsPDF embeds both faces in the PDF. Unsupported glyphs fail explicitly;
there is no transliteration or character substitution.
