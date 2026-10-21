# BookFlow Studio — Book Layout & Print Manager

A local-first book layout and prepress workspace with reusable layout profiles, booklet imposition, print checks and a server-side AI wrapper for Agnes AI and OpenRouter.

## Current application

- Multiple book projects saved to the current browser's local storage; JSON project backup/import.
- TXT/Markdown manuscript import and editing, basic heading detection, page-break markers, undo/redo.
- Book page sizes, orientation, margins, gutter, columns, line spacing, visible page numbers and approximate pagination.
- Reusable named presets:
  - A5 Paperback
  - A6 Pocket Book
  - B5 Textbook (two columns)
  - A4 Colour Workbook
  - A5 Black & White Interior
  - Cover / Photo Job for Epson L8050
- User can save custom named presets and reuse them for future projects in the same browser.
- Reading-order PDF, saddle-stitched booklet PDF, separate manual-duplex front/back PDFs, a single-sided booklet PDF, and a duplex alignment test.
- Signature padding and page-pairing algorithm with geometry calculation; per-sheet preview.
- Printer workflow profiles for Epson ET-4850, Epson L8050 and HP LaserJet Pro 400 variants.
- AI Studio UI for book Q&A, manuscript section lookup, layout/print suggestions, vision input, image generation, asynchronous video jobs/status, model discovery and OpenRouter embeddings.
- GitHub Actions runs syntax checks and page imposition/pagination tests on each push.

## Set up the AI providers

Do not put API keys in the source code, index.html, src/app.mjs, this README, or a committed .env file.

In the Vercel project Dashboard → Settings → Environment Variables, add:

| Name | Provider |
|---|---|
| AGNES_API_KEY | Agnes AI |
| OPENROUTER_API_KEY | OpenRouter |

Enable the variable for the environments where you deploy (normally Production and Preview), save, and redeploy. The UI's API Setup tab shows only whether a key is configured; it never reads or displays key values.

**Agnes endpoints implemented**
- Model discovery: GET https://apihub.agnes-ai.com/v1/models
- Text chat, tool calling and multimodal image input: POST /v1/chat/completions
- Image generation/editing: POST /v1/images/generations
- Async video job creation: POST /v1/videos
- Video result polling: GET /agnesapi?video_id=...&model_name=...

Default documented model IDs in this integration are agnes-2.5-flash for text/vision/tool calling, agnes-image-2.5-flash for image output and agnes-video-2.5-flash for video output. Availability depends on the specific API key and provider account; use “Load models” where supported and check Agnes's current catalog before relying on any model ID.

**OpenRouter endpoints implemented**
- Model discovery: GET https://openrouter.ai/api/v1/models
- Chat/tool calling/vision: POST /api/v1/chat/completions
- Image model catalog: GET /api/v1/images/models
- Dedicated image generation/editing: POST /api/v1/images (base64 response; optional input_references)
- Legacy image output through chat models that support modalities: ["text","image"] remains available in chat requests where the model supports it
- Video model catalog: GET /api/v1/videos/models
- Async video generation: POST /api/v1/videos; poll GET /api/v1/videos/:jobId
- Text embeddings model catalog: GET /api/v1/embeddings/models
- Text embeddings: POST /api/v1/embeddings

OpenRouter requests use the official application-identification headers:
- HTTP-Referer: https://bookflow-studio-git.vercel.app
- X-OpenRouter-Title: BookFlow Studio

BookFlow does not impersonate Claude Code or another external client. If OpenRouter reports an unknown client, check the returned status/message, model access and API key configuration; do not spoof another application's identity.

The browser calls a Vercel serverless route at /api/ai; it does not call provider APIs with exposed keys. That route:
- checks the calling Origin against the BookFlow deployment domains;
- keeps provider keys server-side;
- limits prompt size and permitted actions;
- sends only allow-listed in-app tool calls;
- never performs an unrequested manuscript mutation;
- returns provider errors without returning API key contents.

## Local development and checks

Requires Node.js 20+. Run:

    npm run check
    npm test

The client loads pdf-lib from a public CDN. If that dependency is blocked/offline, PDF export will not work until the library is available.

## Booklet math

For one saddle-stitched signature with local page count N, physical sheet i (zero-based) is paired as:

- Front: [N - 2i, 1 + 2i]
- Back: [2 + 2i, N - 1 - 2i]

The engine maps those local numbers to reading-order indices per signature and represents padding pages as explicit blanks. Automated tests verify that every reader page is preserved exactly once across many page counts and signature sizes.

## Printer guidance for this shop

- **Epson ET-4850:** use as the full-colour interior-page profile. Automatic duplex depends on paper size/media; run a test sheet and check the installed Epson driver. Keep photo/glossy cover work separate from plain-paper duplex work.
- **Epson L8050:** covers and photo work. The preset selects single-sided/manual-duplex workflows; do not assume automatic duplex support.
- **HP LaserJet Pro 400:** black book interiors. Select the exact model when applicable (M401n is manual duplex; M401dn/M401dw list automatic duplex). Other 400-family models need their own driver/model check.

For all printers, use the app's duplex test sheet before printing an entire book. Verify top edge, page order, front/back orientation, scaling and the printer's actual feed path.

## Known limitations

- DOCX/PDF import and OCR are not implemented yet.
- Image placement/anchoring within the manuscript and editable DOCX export are not implemented yet.
- Text pagination/preview use an approximate layout model; exported PDFs must be opened and proofread.
- Urdu/Arabic PDF text is blocked until an appropriate embedded Unicode font and shaping are integrated.
- Full mixed section sizes/orientations, advanced headers/footers, footnotes, table of contents, bleed/crop production features and persistent semantic vector storage are not yet implemented.
- Video generation and AI providers cannot be live-tested without your API keys; key presence is shown by the app, but the provider may still reject a model or quota.
- Vercel project `bookflow-studio-git` is linked to this repository on `main`; pushes trigger production deployments and the GitHub Actions test workflow.

## Official API references

- Agnes AI model catalog: https://github.com/AgnesAI-Labs/AgnesAI-Models
- Agnes AI developer docs: https://agnes-ai.com/doc/overview
- OpenRouter chat completions: https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion
- OpenRouter video generation: https://openrouter.ai/docs/api/api-reference/video-generation/create-videos
- OpenRouter video model catalogue: https://openrouter.ai/collections/video-models/
- OpenRouter image generation: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
- OpenRouter video generation: https://openrouter.ai/docs/api/api-reference/video-generation/create-videos
- OpenRouter video model catalogue: https://openrouter.ai/collections/video-models/
- OpenRouter embeddings: https://openrouter.ai/docs/api/api-reference/embeddings/create-embeddings
- OpenRouter Claude Code guide (only for actual Claude Code traffic): https://openrouter.ai/docs/cookbook/coding-agents/claude-code-integration
