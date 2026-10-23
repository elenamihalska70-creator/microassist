# Invoice PDF fonts

Unmodified static Noto Sans Regular and Bold:
https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans

License and copyright: LICENSE in this directory, SIL Open Font License 1.1.

Vite emits the two TTF files as local assets. invoicePdfFonts.js fetches them only
at first PDF use, shares concurrent requests, caches success and permits retry after
failure. No external font service is used. jsPDF embeds both faces in the PDF.
Unsupported glyphs fail explicitly, without transliteration or substitution.
