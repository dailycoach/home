# Font license record

NAL does not download a font from an external origin at runtime. Its normal typography uses local system fonts. For environments without Korean system glyphs, `nal.css` references the font file that already exists in this repository:

- File: `/programs/art-psychology-coaching/assets/fonts/gowun-batang-700.woff2`
- Family: Gowun Batang Bold
- Designer: Yanghee Ryu
- Copyright: Copyright 2021 The Gowun Batang Project Authors
- License: SIL Open Font License 1.1
- Upstream: https://github.com/yangheeryu/Gowun-Batang
- License text: https://github.com/yangheeryu/Gowun-Batang/blob/master/OFL.txt

The NAL `@font-face` declaration limits this fallback to Korean Unicode ranges and does not modify or rename the font file.
