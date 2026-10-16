# BookFlow Studio — Book Layout & Print Manager

BookFlow Studio is a browser-based personal tool for preparing text manuscripts and generating reading-order PDFs or saddle-stitched booklet PDFs.

## Working in this release

- Multiple book projects, saved in the current browser's local storage.
- JSON project export/import for backups.
- Plain-text and Markdown manuscript import, editing, undo/redo, and manual page-break marker.
- Page format/orientation, margins, gutter, columns, line spacing, title/author metadata, and visible page numbering.
- Approximate live page preview.
- Reading-order PDF export with selectable text.
- Booklet PDF generation with signature padding, corrected reader-page pairing, physical sheet dimensions, proportional fit, fold/alignment marks, and sheet-by-sheet preview.
- Separate manual-duplex front/back PDFs and a single-sided booklet PDF that leaves the reverse of each physical sheet blank.
- A duplex orientation test sheet.
- Printer profiles for Epson ET-4850, Epson L8050, and HP LaserJet Pro 400 family.
- Automated page-order, signature, pagination, and geometry tests in Node.js.

## Run and test

Requires Node.js 20+.

```sh
npm run check
npm test
```

The interface loads `pdf-lib` from a public CDN. If that dependency is blocked/offline, PDF export will not work until the library is bundled locally.

## Booklet imposition

For a signature with N pages, physical sheet i (zero-based) is paired as:

- Front: `[N - 2i, 1 + 2i]`
- Back: `[2 + 2i, N - 1 - 2i]`

Page numbers are local to each signature and then mapped to reader-order indices. Padding blanks are explicit null pages. Automated tests verify that each real reader page is present once and only once across a broad set of page counts and signature sizes.

## Printer guidance (verify the installed model/driver)

- **Epson EcoTank ET-4850 — color interior pages / general jobs:** Epson documents automatic duplex. On the US support guidance, automatic duplex is available for plain paper in A4 or Letter; photo/glossy media is not duplex-compatible. Use the appropriate paper type and test one sheet.
- **Epson L8050 — color covers and photo pages:** published specifications do not list automatic two-sided printing. Use the manual-duplex fronts/backs workflow for suitable media, or print the cover as a separate single-sided job.
- **HP LaserJet Pro 400 family — black book interiors:** the app now asks for the exact model for the M401 variants. HP's M401-series documentation lists the M401n as manual duplex, while M401dn/M401dw list automatic duplex. If your printer is another 400-series model, leave the profile on manual duplex until the exact driver/model is confirmed.

Official references:
- Epson ET-4850 double-sided settings: https://epson.com/faq/SPT_C11CJ60202~faq-0000802-et4850
- Epson ET-4850 supported paper for duplex: https://files.support.epson.com/docid/cpd6/cpd60203/source/printers/source/paper_loading/reference/et4850/double_sided_capacity_us_canada_et4850.html
- Epson L8050 specifications should be checked for the region/model sold in your market.

## Known limitations — not a finished desktop-publishing replacement

- DOCX/PDF import and OCR are not implemented.
- Image upload, anchoring, cropping, and full-page image placement are not implemented.
- Editable DOCX export, automatic table of contents, footnotes, advanced headers/footers, bleed, and reliable mixed-orientation sections are not implemented.
- Pagination and preview use an approximate text-flow model; exported PDF is independently paginated with embedded standard PDF fonts, so the result must be proofread.
- Urdu/Arabic script is deliberately blocked at PDF export until a suitable Unicode font is embedded. Do not use this build to produce Urdu/Arabic text PDFs yet.
- Duplex flip-edge behavior depends on driver, paper orientation, and device. This tool cannot physically verify a printer; print the supplied test sheet before running a book.
- No cross-device/cloud project sync is enabled. Export a JSON backup to keep projects safe.
