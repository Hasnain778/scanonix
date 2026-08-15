/** Central SEO copy and metadata for public tool pages. */

export interface ToolFaqItem {
  question: string;
  answer: string;
}

export interface ToolSeoEntry {
  id: string;
  path: string;
  /** Full browser title, e.g. "Merge PDF Online – Combine PDF Files Free | Scanonix" */
  seoTitle: string;
  metaDescription: string;
  h1: string;
  /** Full intro shown in the below-tool SEO section */
  pageDescription: string;
  /** Optional shorter copy for the page header above the tool UI */
  headerDescription?: string;
  howToSteps: string[];
  whyUse: string[];
  keyFeatures: string[];
  faqs: ToolFaqItem[];
  relatedToolIds: string[];
  keywords?: string[];
  /** Optional supporting SEO sections — only when genuinely tool-specific */
  useCases?: string[];
  limitations?: string[];
}

const BRAND = "Scanonix";

function toolTitle(label: string, benefit?: string): string {
  if (benefit) return `${label} | ${benefit} – ${BRAND}`;
  return `${label} – ${BRAND}`;
}

export const TOOL_SEO: Record<string, ToolSeoEntry> = {
  "merge-pdf": {
    id: "merge-pdf",
    path: "/tools/merge-pdf",
    seoTitle: toolTitle("Merge PDF Online", "Combine PDF Files Free"),
    metaDescription:
      "Merge PDF files online and combine them into one document. Upload multiple PDFs, reorder files, and download a single merged PDF from your browser.",
    h1: "Merge PDF Files Online",
    headerDescription:
      "Combine multiple PDF files into one document. Upload PDFs, drag to reorder, and download — processed locally in your browser.",
    pageDescription:
      "Use Scanonix to merge PDF files online and build one combined document from several uploads. Set file order before download so chapters, invoices, or appendices appear in the right sequence.",
    howToSteps: [
      "Click or drag PDF files into the upload area.",
      "Drag files to set the order you want in the merged document.",
      "Click Merge and download your combined PDF instantly.",
    ],
    whyUse: [
      "Combine reports, invoices, or chapters without desktop software.",
      "Merge runs in your browser — files are not uploaded to Scanonix servers.",
      "Reorder files before merging so the final PDF reads in the right sequence.",
      "Compress the merged PDF afterward if the combined file is too large to email.",
    ],
    useCases: [
      "Join separate contract sections into one signed PDF packet.",
      "Combine scanned receipts or statements for expense reporting.",
      "Merge course handouts or report chapters into a single reading file.",
      "Build one submission PDF from multiple exported attachments.",
    ],
    limitations: [
      "Input files must be PDF documents.",
      "Very large files or long merge jobs may be limited by browser memory.",
      "Password-protected PDFs must be unlocked before merging.",
      "Merge combines whole files in the order you choose — use Split PDF first if you only need selected pages.",
    ],
    keyFeatures: [
      "Combine multiple PDFs in one session",
      "Drag-and-drop file ordering",
      "Local browser processing",
      "Instant download",
    ],
    faqs: [
      {
        question: "How do I merge PDF files online?",
        answer:
          "Upload two or more PDF files, drag them into the order you want, and click Merge to download one combined document.",
      },
      {
        question: "Can I combine PDFs without installing software?",
        answer:
          "Yes. Scanonix merges PDFs in your browser, so no desktop app is required.",
      },
      {
        question: "Are my PDFs uploaded to a server when merging?",
        answer:
          "No. Merge PDF runs locally in your browser, so your documents stay on your device during processing.",
      },
      {
        question: "What should I do if the merged PDF is too large?",
        answer:
          "Use Compress PDF after merging to reduce the final file size for email or upload limits.",
      },
      {
        question: "Can I merge only some pages from each PDF?",
        answer:
          "Merge combines whole PDF files. Use Split PDF first if you need to extract specific pages before combining.",
      },
    ],
    relatedToolIds: ["compress-pdf", "split-pdf", "pdf-to-word", "sign-pdf", "organize-pdf", "crop-pdf", "add-page-numbers", "fill-pdf"],
    keywords: ["merge pdf", "combine pdf files", "join pdf online", "pdf merger free"],
  },
  "split-pdf": {
    id: "split-pdf",
    path: "/tools/split-pdf",
    seoTitle: toolTitle("Split PDF Online Free", "Extract or Divide PDF Pages"),
    metaDescription:
      "Split PDF pages online for free. Extract selected pages or divide a large PDF into separate files — fast, private, and processed in your browser.",
    h1: "Split PDF Files Online",
    pageDescription:
      "Extract pages from a PDF or divide a document into smaller files with Scanonix. Select page ranges, split, and download new PDFs without desktop software.",
    howToSteps: [
      "Upload the PDF you want to split.",
      "Select pages or ranges to extract.",
      "Download the new PDF file or files.",
    ],
    whyUse: [
      "Pull out one chapter, invoice, or appendix without editing the whole file.",
      "Split large PDFs into smaller files for email or upload limits.",
      "Processing happens locally so sensitive documents stay on your device.",
      "Pair with Merge PDF when reorganising multi-part documents.",
    ],
    keyFeatures: [
      "Extract specific page ranges",
      "Split into multiple files",
      "Local browser processing",
      "Works on scanned and text PDFs",
    ],
    faqs: [
      {
        question: "How do I split a PDF online?",
        answer:
          "Upload your PDF, choose the pages or ranges to extract, and download the resulting file or files.",
      },
      {
        question: "Can I extract just a few pages from a PDF?",
        answer: "Yes. Select the pages or ranges you need and download them as a new PDF.",
      },
      {
        question: "Will split PDFs keep the same quality?",
        answer: "Yes. Splitting copies original page content without re-compressing images.",
      },
      {
        question: "Can I split a PDF into individual pages?",
        answer:
          "Yes. Select multiple ranges or use the tool workflow to export separate sections as needed.",
      },
      {
        question: "Is Split PDF free?",
        answer:
          "Yes. Split PDF is free to use in your browser with standard usage limits for heavy workflows.",
      },
    ],
    relatedToolIds: ["merge-pdf", "compress-pdf", "rotate-pdf", "sign-pdf", "organize-pdf", "crop-pdf", "add-page-numbers", "fill-pdf"],
    keywords: ["split pdf", "extract pdf pages", "divide pdf online", "split pdf free"],
  },
  "compress-pdf": {
    id: "compress-pdf",
    path: "/tools/compress-pdf",
    seoTitle: toolTitle("Compress PDF Online", "Reduce PDF File Size"),
    metaDescription:
      "Compress PDF files online to reduce file size for email and uploads. Choose Light, Recommended, or Strong compression with secure server-side processing.",
    h1: "Compress PDF Without Losing Quality",
    headerDescription:
      "Reduce PDF file size with adjustable compression levels. Upload a PDF, pick Light, Recommended, or Strong, then download a smaller file.",
    pageDescription:
      "Shrink PDF file size with adjustable compression levels. Use Light compression when you want smaller files with minimal visible change, or stronger settings when email limits matter most.",
    howToSteps: [
      "Upload the PDF you want to compress.",
      "Select Light, Recommended, or Strong compression.",
      "Review the size reduction, then download the compressed PDF.",
    ],
    whyUse: [
      "Light compression keeps text sharp while trimming image-heavy pages.",
      "Pick the level that fits your file — reports, scans, or photo PDFs.",
      "Compression is performed on Scanonix servers.",
      "Download a smaller PDF ready for email, uploads, or storage.",
    ],
    useCases: [
      "Email a report that exceeds your provider’s attachment limit.",
      "Upload a scanned document to a portal with a strict file-size cap.",
      "Share a presentation PDF without sending the original large export.",
      "Reduce storage size before archiving older document folders.",
    ],
    limitations: [
      "Text-only PDFs may not shrink much because there is little image data to optimise.",
      "Strong compression re-encodes page images and reduces photo detail more noticeably.",
      "Password-protected PDFs must be unlocked before compression.",
      "Very large files may take longer depending on page count and your device.",
    ],
    keyFeatures: [
      "Light, Recommended, and Strong compression levels",
      "Size preview before download",
      "Secure server-side PDF compression",
      "Readable text at lighter settings",
    ],
    faqs: [
      {
        question: "Can I compress a PDF without losing quality?",
        answer:
          "Use Light compression for the smallest visible change. Scanonix re-encodes embedded images at higher JPEG quality so text stays readable, but some image detail may still change.",
      },
      {
        question: "Which compression level should I choose?",
        answer:
          "Light suits documents you still need to read closely. Recommended balances size and clarity. Strong is best when you mainly need a smaller attachment.",
      },
      {
        question: "Will my text become blurry?",
        answer:
          "Body text usually stays readable, especially on Light and Recommended. Strong compression affects photos and screenshots more than plain text pages.",
      },
      {
        question: "Are my files uploaded to Scanonix servers?",
        answer:
          "Yes. Your PDF is uploaded securely and compressed on Scanonix servers. The compressed file is returned for download in your browser.",
      },
      {
        question: "What should I use after compressing a large merged PDF?",
        answer:
          "If you combined files first, compress the final PDF. Use Merge PDF or Split PDF when you need to reorganise pages beforehand.",
      },
    ],
    relatedToolIds: ["merge-pdf", "split-pdf", "pdf-to-word", "sign-pdf", "organize-pdf", "crop-pdf", "add-page-numbers", "fill-pdf"],
    keywords: [
      "compress pdf without losing quality",
      "reduce pdf size",
      "compress pdf online",
      "pdf compressor",
    ],
  },
  "pdf-to-word": {
    id: "pdf-to-word",
    path: "/tools/pdf-to-word",
    seoTitle: toolTitle("PDF to Word Converter Online", "PDF to DOCX"),
    metaDescription:
      "Convert PDF to Word online and download an editable DOCX file. Secure server-side conversion with OCR support for scanned PDFs.",
    h1: "Convert PDF to Word Online",
    headerDescription:
      "Turn PDF files into editable Word documents. Upload a PDF, get DOCX output, and edit in Word or Google Docs.",
    pageDescription:
      "Convert PDF to Word or DOCX while keeping headings, paragraphs, and tables editable where possible. Your PDF is securely uploaded and converted using Scanonix's conversion service.",
    howToSteps: [
      "Upload your PDF file.",
      "Scanonix extracts text, headings, and tables into DOCX format.",
      "Download the Word file and edit it in Microsoft Word, Google Docs, or LibreOffice.",
    ],
    whyUse: [
      "Edit contracts, forms, and reports that arrived as PDF.",
      "Recover workable structure instead of retyping page by page.",
      "Handle scanned PDFs with built-in OCR fallback.",
      "Open the output DOCX in the word processor you already use.",
    ],
    useCases: [
      "Update an old PDF résumé or proposal without starting from scratch.",
      "Extract tables from a PDF report into an editable Word document.",
      "Convert a scanned paper form so you can fill it digitally.",
      "Move archive PDFs into a format your team can comment on and revise.",
    ],
    limitations: [
      "Complex magazine-style layouts, multi-column designs, and custom fonts may need manual cleanup.",
      "Scanned pages rely on OCR, so accuracy depends on scan quality and language.",
      "Password-protected PDFs must be unlocked before conversion.",
      "Embedded images and exact pixel-perfect spacing may not match the original PDF.",
    ],
    keyFeatures: [
      "DOCX output for Word and Google Docs",
      "Native text extraction with OCR fallback",
      "Headings, paragraphs, and tables where detected",
      "Secure server-side conversion",
    ],
    faqs: [
      {
        question: "Can I convert a scanned PDF to Word?",
        answer:
          "Yes. Scanonix detects image-only pages and runs OCR before building the DOCX file.",
      },
      {
        question: "Can I convert PDF to Word without losing formatting?",
        answer:
          "Scanonix keeps headings, paragraphs, and tables when they can be read from the PDF. Complex designs may need minor edits after conversion.",
      },
      {
        question: "Does this work on scanned PDFs?",
        answer:
          "Yes. When a page is an image of text, Scanonix runs OCR to extract editable content before building the DOCX file.",
      },
      {
        question: "Will tables transfer to Word?",
        answer:
          "Tables usually carry over when the PDF contains structured table data. Very complex or merged layouts may need adjustment.",
      },
      {
        question: "Should I run OCR before converting to Word?",
        answer:
          "The tool handles OCR automatically for scanned pages. Use the standalone OCR tool if you only need plain text extraction.",
      },
      {
        question: "Is PDF to Word free?",
        answer:
          "PDF to Word requires a signed-in account and counts toward your plan usage limits. Upload your PDF securely for server-side conversion.",
      },
    ],
    relatedToolIds: ["ocr", "word-to-pdf", "compress-pdf", "sign-pdf"],
    keywords: [
      "pdf to word without losing formatting",
      "pdf to docx",
      "convert pdf to word online",
      "pdf to word free",
    ],
  },
  "word-to-pdf": {
    id: "word-to-pdf",
    path: "/tools/word-to-pdf",
    seoTitle: toolTitle("Word to PDF Online", "Convert DOCX to PDF Free"),
    metaDescription:
      "Convert Word documents to PDF online. Upload a .docx file and download a polished PDF ready to share or print.",
    h1: "Word to PDF",
    pageDescription:
      "Convert .docx Word documents into polished PDF files ready to share, print, or archive.",
    howToSteps: [
      "Upload your .docx Word document.",
      "Scanonix converts it to PDF format.",
      "Download the finished PDF.",
    ],
    whyUse: [
      "Share documents in a format everyone can open.",
      "Lock layout before sending proposals or CVs.",
      "Create print-ready PDFs from editable Word files.",
    ],
    keyFeatures: [
      "Supports .docx files",
      "Clean PDF output",
      "Quick one-step conversion",
      "Download instantly",
    ],
    faqs: [
      {
        question: "Does Word to PDF support .doc files?",
        answer: "Upload .docx files for the most reliable conversion results.",
      },
      {
        question: "Will fonts and spacing be preserved?",
        answer: "Scanonix aims to keep document layout faithful to the original Word file.",
      },
    ],
    relatedToolIds: ["pdf-to-word", "merge-pdf", "compress-pdf", "protect-pdf"],
    keywords: ["word to pdf", "docx to pdf", "convert word to pdf online"],
  },
  "pdf-to-image": {
    id: "pdf-to-image",
    path: "/tools/pdf-to-image",
    seoTitle: toolTitle("PDF to Image Converter Online", "Export PDF Pages as JPG or PNG"),
    metaDescription:
      "Convert PDF pages to JPG, PNG, or WEBP images online. Export every page at high quality from your browser — ideal for slides, posts, and design assets.",
    h1: "Convert PDF to Images Online",
    pageDescription:
      "Export PDF pages as JPG, PNG, or WEBP images with Scanonix. Upload a PDF, choose your output format, and download individual pages or a ZIP of all pages.",
    howToSteps: [
      "Upload the PDF you want to convert.",
      "Choose output format and quality settings.",
      "Download individual images or a ZIP of all pages.",
    ],
    whyUse: [
      "Use PDF slides or diagrams in presentations and social posts.",
      "Share a single page as an image without sending the full document.",
      "Extract visuals while keeping processing local in your browser.",
      "Choose PNG for sharp text or JPG for photo-heavy pages.",
    ],
    keyFeatures: [
      "JPG, PNG, and WEBP export",
      "High-quality page rendering",
      "Local browser processing",
      "Batch export all pages",
    ],
    faqs: [
      {
        question: "How do I convert a PDF to images online?",
        answer:
          "Upload your PDF, pick JPG, PNG, or WEBP, and download the exported pages from your browser.",
      },
      {
        question: "Can I export every page from a PDF?",
        answer: "Yes. All pages can be exported as separate image files or downloaded together.",
      },
      {
        question: "Which image format should I choose?",
        answer: "Use PNG for sharp text, JPG for photos, and WEBP for smaller web files.",
      },
      {
        question: "Will image quality match the PDF?",
        answer:
          "Export quality depends on your settings. Higher quality preserves detail but creates larger files.",
      },
      {
        question: "Is PDF to Image free?",
        answer:
          "Yes. PDF to Image runs free in your browser with standard usage limits.",
      },
    ],
    relatedToolIds: ["image-to-pdf", "ocr", "compress-pdf", "split-pdf"],
    keywords: ["pdf to jpg", "pdf to png", "pdf to image online", "export pdf pages"],
  },
  "image-to-pdf": {
    id: "image-to-pdf",
    path: "/tools/image-to-pdf",
    seoTitle: toolTitle("Image to PDF Converter Online", "JPG & PNG to PDF"),
    metaDescription:
      "Convert JPG and PNG images to PDF online. Combine multiple photos into one PDF, reorder pages, and download from your browser.",
    h1: "Convert Images to PDF Online",
    headerDescription:
      "Turn JPG and PNG images into one PDF file. Upload multiple photos, set page order, and download a combined PDF from your browser.",
    pageDescription:
      "Convert images to PDF and combine several JPG or PNG files into a single document. Drag photos into the order you want, then download one shareable PDF.",
    howToSteps: [
      "Upload two or more JPG, JPEG, or PNG images.",
      "Drag images to arrange the page order.",
      "Download the combined PDF file.",
    ],
    whyUse: [
      "Bundle receipt photos, notes, or ID scans into one file.",
      "Send one PDF attachment instead of many separate images.",
      "Create a simple photo album or portfolio PDF from camera shots.",
      "Processing runs locally in your browser.",
    ],
    useCases: [
      "Submit several photographed documents as one PDF upload.",
      "Share a set of product photos with a client in a single file.",
      "Combine handwritten notes or whiteboard photos into one archive PDF.",
      "Turn phone pictures of paper pages into a readable document bundle.",
    ],
    limitations: [
      "Supported inputs are JPG, JPEG, and PNG.",
      "Each image becomes one PDF page at its original orientation and size.",
      "Very large images may increase PDF file size before compression.",
      "This tool builds a PDF from images — it does not OCR text inside photos.",
    ],
    keyFeatures: [
      "Multi-image upload",
      "Drag-and-drop page ordering",
      "Local browser processing",
      "Single PDF download",
    ],
    faqs: [
      {
        question: "Can I convert JPG or PNG to PDF?",
        answer:
          "Yes. Upload JPG, JPEG, or PNG images and Scanonix builds a PDF with one page per image.",
      },
      {
        question: "How do I convert multiple images to one PDF?",
        answer:
          "Upload your images, arrange them in the order you want, and click to generate one PDF containing every page.",
      },
      {
        question: "How many images can I combine?",
        answer:
          "You can add multiple images in one session. Practical limits depend on file sizes and your browser memory.",
      },
      {
        question: "Can I change the page order after uploading?",
        answer: "Yes. Drag and drop images in the list before creating the PDF.",
      },
      {
        question: "Which image formats are supported?",
        answer: "JPG, JPEG, and PNG files can be combined into a PDF.",
      },
      {
        question: "How do I make the final PDF smaller?",
        answer:
          "After creating the PDF, use Compress PDF to reduce file size for email or upload limits.",
      },
    ],
    relatedToolIds: ["compress-pdf", "merge-pdf", "png-to-jpg", "jpg-to-png"],
    keywords: [
      "image to pdf",
      "jpg to pdf",
      "png to pdf",
      "convert multiple images to one pdf",
    ],
  },
  "rotate-pdf": {
    id: "rotate-pdf",
    path: "/tools/rotate-pdf",
    seoTitle: toolTitle("Rotate PDF Online", "Turn PDF Pages Free"),
    metaDescription:
      "Rotate PDF pages online by 90°, 180°, or 270°. Fix sideways scans and downloads — processed locally in your browser.",
    h1: "Rotate PDF",
    pageDescription:
      "Rotate PDF pages by 90°, 180°, or 270° — all pages or a custom selection — processed in your browser.",
    howToSteps: [
      "Upload the PDF with misaligned pages.",
      "Choose rotation angle and page selection.",
      "Download the corrected PDF.",
    ],
    whyUse: [
      "Fix scanned documents that imported sideways.",
      "Correct orientation before merging or sharing PDFs.",
      "Rotate only the pages you need without re-scanning.",
    ],
    keyFeatures: [
      "90°, 180°, and 270° rotation",
      "All pages or custom selection",
      "Local browser processing",
      "Instant download",
    ],
    faqs: [
      {
        question: "Can I rotate just one page?",
        answer: "Yes. Select specific pages instead of rotating the entire document.",
      },
      {
        question: "Is rotation permanent?",
        answer: "Yes. The downloaded PDF saves pages in the new orientation.",
      },
    ],
    relatedToolIds: ["split-pdf", "merge-pdf", "compress-pdf", "sign-pdf", "organize-pdf", "crop-pdf", "add-page-numbers", "fill-pdf"],
    keywords: ["rotate pdf", "turn pdf pages", "fix pdf orientation"],
  },
  "organize-pdf": {
    id: "organize-pdf",
    path: "/tools/organize-pdf",
    seoTitle: "Organize PDF Online — Reorder, Rotate & Delete Pages | Scanonix",
    metaDescription:
      "Organize PDF pages online by reordering, rotating, and deleting pages. Process your PDF locally in your browser with Scanonix.",
    h1: "Organize PDF",
    headerDescription:
      "Reorder, rotate, and remove pages from a PDF — processed locally in your browser.",
    pageDescription:
      "Organize PDF pages online by reordering, rotating, and deleting pages. Upload a PDF, arrange pages in the order you want, rotate or remove unwanted pages, then download — all processed locally in your browser.",
    howToSteps: [
      "Upload the PDF you want to organize.",
      "Drag pages to reorder, rotate individual pages, or delete pages you do not need.",
      "Export and download your organized PDF.",
    ],
    whyUse: [
      "Fix page order after scanning or merging documents.",
      "Remove blank or duplicate pages without desktop software.",
      "Rotate misaligned pages while rearranging the full document.",
      "Processing happens locally so your PDF stays on your device.",
    ],
    keyFeatures: [
      "Drag-and-drop page reordering",
      "Rotate pages by 90° increments",
      "Delete unwanted pages",
      "Local browser processing",
      "Instant download",
    ],
    faqs: [
      {
        question: "How do I reorder PDF pages online?",
        answer:
          "Upload your PDF, drag pages into the order you want, then export and download the reorganized document.",
      },
      {
        question: "Can I delete pages from a PDF?",
        answer:
          "Yes. Remove unwanted pages before exporting, and the downloaded PDF will contain only the remaining pages.",
      },
      {
        question: "Can I rotate pages while organizing a PDF?",
        answer:
          "Yes. Rotate individual pages by 90° increments while reordering or before export.",
      },
      {
        question: "Is my PDF uploaded to Scanonix servers?",
        answer:
          "No. Organize PDF runs locally in your browser, so your document stays on your device during processing.",
      },
      {
        question: "How is Organize PDF different from Split PDF or Rotate PDF?",
        answer:
          "Organize PDF combines reordering, rotation, and deletion in one workflow. Use Split PDF to extract ranges into separate files, or Rotate PDF when you only need to fix orientation.",
      },
    ],
    relatedToolIds: ["merge-pdf", "split-pdf", "rotate-pdf", "sign-pdf", "compress-pdf", "crop-pdf", "add-page-numbers", "fill-pdf"],
    keywords: [
      "organize pdf",
      "reorder pdf pages",
      "arrange pdf pages",
      "delete pdf pages",
      "pdf page organizer",
    ],
  },
  "crop-pdf": {
    id: "crop-pdf",
    path: "/tools/crop-pdf",
    seoTitle: "Crop PDF Online — Trim PDF Page Margins | Scanonix",
    metaDescription:
      "Crop PDF pages online by selecting the visible area you want to keep. Crop individual or multiple pages locally in your browser with Scanonix.",
    h1: "Crop PDF",
    headerDescription:
      "Crop PDF pages online by selecting the visible area you want to keep — processed locally in your browser.",
    pageDescription:
      "Crop PDF pages online by selecting the visible area you want to keep. Upload a PDF, adjust the crop area on individual or multiple pages, then download the trimmed document — all processed locally in your browser.",
    howToSteps: [
      "Upload the PDF you want to crop.",
      "Select a page and drag the crop handles to define the visible area you want to keep.",
      "Apply the same crop to other pages or adjust each page individually.",
      "Export and download your cropped PDF.",
    ],
    whyUse: [
      "Remove unwanted margins or scanner borders from PDF pages.",
      "Focus on the content area without desktop PDF software.",
      "Crop multiple pages with per-page or shared crop settings.",
      "Processing happens locally so your PDF stays on your device.",
    ],
    keyFeatures: [
      "Interactive crop overlay with drag handles",
      "Per-page or apply-to-all cropping",
      "Reset individual pages or all crops",
      "Local browser processing",
      "Instant download",
    ],
    faqs: [
      {
        question: "How do I crop a PDF online?",
        answer:
          "Upload your PDF, drag the crop handles to select the visible area you want to keep, then export and download the cropped document.",
      },
      {
        question: "Can I crop individual PDF pages?",
        answer:
          "Yes. Select each page and adjust its crop area, or apply one crop setting to all pages at once.",
      },
      {
        question: "Can I trim PDF margins?",
        answer:
          "Yes. Drag the crop handles inward to remove excess margins, scanner borders, or blank edges from each page.",
      },
      {
        question: "Is my PDF uploaded to Scanonix servers?",
        answer:
          "No. Your PDF is cropped locally in your browser and is not uploaded to Scanonix servers.",
      },
      {
        question: "How is Crop PDF different from Split PDF or Organize PDF?",
        answer:
          "Crop PDF changes the visible page area by trimming margins or edges. Use Split PDF to extract pages into separate files, or Organize PDF to reorder, rotate, or delete pages.",
      },
      {
        question: "Can I use Crop PDF to securely redact sensitive information?",
        answer:
          "No. Crop PDF only changes the visible page area. It is not a substitute for secure redaction and does not remove hidden text, metadata, or content outside the crop box.",
      },
      {
        question: "Does cropping rasterize or flatten my PDF?",
        answer:
          "No. Crop PDF preserves text and vector content within the visible area. It adjusts the page crop box rather than converting pages to flat images.",
      },
    ],
    relatedToolIds: [
      "organize-pdf",
      "rotate-pdf",
      "split-pdf",
      "merge-pdf",
      "sign-pdf",
      "add-page-numbers",
      "fill-pdf",
      "redact-pdf",
    ],
    keywords: [
      "crop pdf",
      "trim pdf margins",
      "clip pdf pages",
      "pdf crop online",
      "cut pdf margins",
    ],
  },
  "add-page-numbers": {
    id: "add-page-numbers",
    path: "/tools/add-page-numbers",
    seoTitle: "Add Page Numbers to PDF Online | Scanonix",
    metaDescription:
      "Add page numbers to PDF files online. Choose page range, starting number, format and position, then export locally in your browser with Scanonix.",
    h1: "Add Page Numbers",
    headerDescription:
      "Add page numbers to PDF pages online with custom position, format, range, and starting number — processed locally in your browser.",
    pageDescription:
      "Add page numbers to PDF pages online with custom position, format, range, and starting number. Upload a PDF, choose which pages to number, set the format and placement, then download — all processed locally in your browser.",
    howToSteps: [
      "Upload the PDF you want to number.",
      "Choose all pages or a custom page range, starting number, format, and position.",
      "Preview page numbers on each page and adjust font size, margin, or color if needed.",
      "Export and download your numbered PDF.",
    ],
    whyUse: [
      "Number reports, contracts, and scanned documents without desktop software.",
      "Choose from multiple formats such as plain numbers or page X of Y.",
      "Place numbers in six positions with adjustable margin and font size.",
      "Processing happens locally so your PDF stays on your device.",
    ],
    keyFeatures: [
      "Custom page range or all pages",
      "Multiple number formats",
      "Six position presets with margin control",
      "Adjustable font size and color",
      "Local browser processing",
      "Instant download",
    ],
    faqs: [
      {
        question: "How do I add page numbers to a PDF online?",
        answer:
          "Upload your PDF, choose the pages to number, set the starting number, format, and position, then export and download the numbered document.",
      },
      {
        question: "Is my PDF uploaded to Scanonix servers?",
        answer:
          "No. Add Page Numbers runs locally in your browser, so your document stays on your device during processing.",
      },
      {
        question: "Does adding page numbers rasterize or flatten my PDF?",
        answer:
          "No. Page numbers are added as text overlays. Your original page content is not converted to flat images.",
      },
      {
        question: "Can I number only selected pages?",
        answer:
          "Yes. Choose all pages or enter a custom range such as 1-5 or 1,3,5 to number only the pages you need.",
      },
      {
        question: "What number formats are supported?",
        answer:
          "You can use plain numbers (1), page labels (Page 1), totals (1 of 10), or combined labels (Page 1 of 10).",
      },
      {
        question: "Where can page numbers be placed?",
        answer:
          "Choose from six positions: top-left, top-center, top-right, bottom-left, bottom-center, or bottom-right, with adjustable margin.",
      },
      {
        question: "Can I change the starting page number?",
        answer:
          "Yes. Set any starting number so numbering can begin at 1, continue from a previous section, or match your document structure.",
      },
    ],
    relatedToolIds: [
      "organize-pdf",
      "crop-pdf",
      "rotate-pdf",
      "split-pdf",
      "merge-pdf",
      "sign-pdf",
      "fill-pdf",
    ],
    keywords: [
      "add page numbers to pdf",
      "pdf page numbers",
      "number pdf pages",
      "page numbering pdf",
      "insert page numbers pdf",
    ],
  },
  "fill-pdf": {
    id: "fill-pdf",
    path: "/tools/fill-pdf",
    seoTitle: "Fill PDF Form Online | Scanonix",
    metaDescription:
      "Fill interactive PDF form fields online in your browser. Edit supported AcroForm fields and download the completed PDF with local browser processing.",
    h1: "Fill PDF Form",
    headerDescription:
      "Fill interactive PDF form fields online — text, checkboxes, radio buttons, and dropdowns — processed locally in your browser.",
    pageDescription:
      "Fill interactive PDF form fields online in your browser. Upload a PDF with AcroForm fields, edit text, checkboxes, radio buttons, and dropdowns directly on the document, then download the completed PDF — all processed locally on your device.",
    howToSteps: [
      "Upload a PDF that contains interactive form fields.",
      "Click fields directly on the PDF preview to enter text or select options.",
      "Use the Fields navigator if you need to jump to a specific field.",
      "Export and download your filled PDF.",
    ],
    whyUse: [
      "Complete government, tax, and application forms without desktop PDF software.",
      "Edit fields directly on the PDF instead of a separate form panel.",
      "Processing happens locally so your document stays on your device.",
      "Download an interactive PDF you can reopen and continue editing.",
    ],
    keyFeatures: [
      "Direct on-PDF field editing",
      "Text, checkbox, radio, dropdown, and option-list fields",
      "AcroForm support with local browser processing",
      "Text formatting with font size, bold, and italic",
      "Fields navigator for quick field access",
      "Instant download of filled PDF",
    ],
    faqs: [
      {
        question: "How do I fill a PDF form online?",
        answer:
          "Upload your PDF, click the form fields directly on the document preview, enter your answers, then export and download the completed PDF.",
      },
      {
        question: "Is my PDF uploaded to Scanonix servers?",
        answer:
          "No. Fill PDF Form runs locally in your browser, so your document stays on your device during processing.",
      },
      {
        question: "Can I fill any PDF?",
        answer:
          "This tool supports PDFs with interactive AcroForm fields. Static PDFs that are only images or plain text may not contain editable form fields.",
      },
      {
        question: "Does Fill PDF support XFA forms?",
        answer:
          "No. Fill PDF Form supports standard AcroForm fields only. PDFs that use XFA forms are not supported in this version.",
      },
      {
        question: "Will my filled PDF remain editable?",
        answer:
          "Yes. By default, exported PDFs keep interactive form fields so you can reopen and edit them later.",
      },
      {
        question: "Can I sign a PDF with this tool?",
        answer:
          "Fill PDF Form is for editing form field values. Use Sign PDF to add drawn, typed, or uploaded signatures.",
      },
      {
        question: "Does Fill PDF support underline formatting?",
        answer:
          "Bold, italic, and font size controls are supported for text fields. Underline is not supported in this version.",
      },
    ],
    relatedToolIds: [
      "sign-pdf",
      "add-page-numbers",
      "crop-pdf",
      "organize-pdf",
      "merge-pdf",
      "split-pdf",
    ],
    keywords: [
      "fill pdf",
      "fill pdf form",
      "pdf form filler",
      "fill out pdf online",
      "acroform",
      "pdf form fields",
    ],
  },
  "sign-pdf": {
    id: "sign-pdf",
    path: "/tools/sign-pdf",
    seoTitle: "Sign PDF Online — Add a Signature to PDF | Scanonix",
    metaDescription:
      "Sign PDF documents online by drawing, typing, or uploading a signature. Place and resize signatures on any page and download the signed PDF.",
    h1: "Sign PDF",
    headerDescription:
      "Add signatures to PDF documents in your browser. Draw, type, or upload a signature, place it on any page, and download — processed locally on your device.",
    pageDescription:
      "Sign PDF files online without desktop software. Create a signature by drawing, typing, or uploading an image, place it on any page, resize and reposition as needed, then download the signed PDF — all processed locally in your browser.",
    howToSteps: [
      "Upload the PDF you want to sign.",
      "Create a signature by drawing, typing, or uploading an image.",
      "Place the signature on any page, resize and reposition as needed.",
      "Download the signed PDF.",
    ],
    whyUse: [
      "Sign contracts, forms, and agreements without printing and scanning.",
      "Add a personal signature to PDFs before sharing or submitting.",
      "Processing happens locally so your document stays on your device.",
      "Place signatures on multiple pages when a document needs repeated signing.",
    ],
    keyFeatures: [
      "Draw, type, or upload signatures",
      "Place signatures on any page",
      "Drag and resize signature placement",
      "Local browser processing",
      "Instant download of signed PDF",
    ],
    faqs: [
      {
        question: "How do I sign a PDF?",
        answer:
          "Upload your PDF, create a signature by drawing, typing, or uploading an image, place it on the page where you need it, then download the signed PDF.",
      },
      {
        question: "Can I draw my signature?",
        answer:
          "Yes. Use the Draw tab in the signature creator to draw your signature with a mouse, trackpad, or touch screen.",
      },
      {
        question: "Can I type my signature?",
        answer:
          "Yes. Choose the Type tab, enter your name, and pick a handwriting-style font for a typed signature.",
      },
      {
        question: "Can I upload a signature image?",
        answer:
          "Yes. Upload a PNG or JPG image of your signature and place it on the PDF like any other signature.",
      },
      {
        question: "Can I sign multiple pages?",
        answer:
          "Yes. Navigate to each page and add signature placements wherever you need them before downloading.",
      },
      {
        question: "Is my PDF uploaded to Scanonix servers?",
        answer:
          "PDF and signature processing for this tool occurs locally in your browser.",
      },
      {
        question: "Does Sign PDF create a certificate-based digital signature?",
        answer:
          "No. Sign PDF adds a visual signature overlay to your document. It does not apply a cryptographic digital signature or certificate-based e-signature recognized by Adobe Acrobat or legal PKI systems.",
      },
    ],
    relatedToolIds: ["merge-pdf", "split-pdf", "rotate-pdf", "compress-pdf", "pdf-to-word", "organize-pdf", "crop-pdf", "add-page-numbers", "fill-pdf"],
    keywords: [
      "sign pdf",
      "pdf signature",
      "add signature to pdf",
      "sign pdf online",
      "electronic signature pdf",
      "draw signature on pdf",
    ],
  },
  "protect-pdf": {
    id: "protect-pdf",
    path: "/tools/protect-pdf",
    seoTitle: toolTitle("Protect PDF Online", "Password-Protect PDF Files"),
    metaDescription:
      "Password-protect PDF files online with Scanonix. Encrypt sensitive documents with a password you choose — your password is not stored by Scanonix.",
    h1: "Password-Protect PDF Online",
    pageDescription:
      "Add password protection to PDF files with Scanonix. Upload a document, set a password, and download an encrypted copy ready to share securely.",
    howToSteps: [
      "Upload the PDF you want to protect.",
      "Enter and confirm a strong password.",
      "Download the encrypted PDF.",
    ],
    whyUse: [
      "Share confidential reports with password protection.",
      "Add a security layer before emailing contracts or statements.",
      "Control who can open sensitive documents.",
      "Pair with Unlock PDF when you need to remove protection later.",
    ],
    keyFeatures: [
      "Password encryption",
      "Password not stored by Scanonix",
      "Works with existing PDFs",
      "Download protected copy instantly",
    ],
    faqs: [
      {
        question: "How do I password-protect a PDF online?",
        answer:
          "Upload your PDF, enter a password, confirm it, and download the encrypted file.",
      },
      {
        question: "Does Scanonix store my PDF password?",
        answer: "No. Your password is used only to encrypt the file and is not saved.",
      },
      {
        question: "Can I remove the password later?",
        answer: "Use the Unlock PDF tool with the correct password to remove protection.",
      },
      {
        question: "Is Protect PDF a Pro feature?",
        answer:
          "Yes. PDF protection is part of Scanonix Pro security tools.",
      },
      {
        question: "Will protecting a PDF change its content?",
        answer:
          "No. Encryption adds open-password protection without altering page content.",
      },
    ],
    relatedToolIds: ["unlock-pdf", "redact-pdf", "watermark-pdf", "compress-pdf"],
    keywords: ["protect pdf", "password pdf", "encrypt pdf online", "pdf password protect"],
  },
  "unlock-pdf": {
    id: "unlock-pdf",
    path: "/tools/unlock-pdf",
    seoTitle: toolTitle("Unlock PDF Online", "Remove PDF Password"),
    metaDescription:
      "Unlock password-protected PDFs online when you know the password. Remove open restrictions and download an unprotected copy with Scanonix.",
    h1: "Unlock PDF Online",
    pageDescription:
      "Remove password protection from PDFs when you have the correct password. Upload a protected file, enter the password, and download an open copy.",
    howToSteps: [
      "Upload the protected PDF.",
      "Enter the document password.",
      "Download the unlocked PDF without password protection.",
    ],
    whyUse: [
      "Open PDFs you own but can no longer edit because of old passwords.",
      "Remove protection before merging or compressing files.",
      "Recover workflow access to archived documents.",
      "Works alongside Protect PDF for full password workflows.",
    ],
    keyFeatures: [
      "Removes open-password protection",
      "Requires correct password",
      "Instant download",
      "Pairs with Protect PDF",
    ],
    faqs: [
      {
        question: "How do I unlock a password-protected PDF?",
        answer:
          "Upload the protected PDF, enter the correct password, and download the unlocked version.",
      },
      {
        question: "Can Scanonix unlock PDFs without the password?",
        answer: "No. You must provide the correct password to unlock a protected PDF.",
      },
      {
        question: "Will unlocking change the document content?",
        answer: "No. Only password protection is removed; page content stays the same.",
      },
      {
        question: "Is Unlock PDF a Pro feature?",
        answer:
          "Yes. Unlock PDF is part of Scanonix Pro security tools.",
      },
      {
        question: "Can I unlock a PDF and then merge it?",
        answer:
          "Yes. Unlock first, then use Merge PDF or other tools on the open copy.",
      },
    ],
    relatedToolIds: ["protect-pdf", "merge-pdf", "compress-pdf", "redact-pdf"],
    keywords: ["unlock pdf", "remove pdf password", "decrypt pdf online", "pdf unlock free"],
  },
  "watermark-pdf": {
    id: "watermark-pdf",
    path: "/tools/watermark-pdf",
    seoTitle: toolTitle("Watermark PDF Online", "Add Text or Image Watermarks"),
    metaDescription:
      "Add text or image watermarks to PDF pages online. Mark drafts, confidential copies, or branded documents before sharing.",
    h1: "Watermark PDF",
    pageDescription:
      "Apply customizable text or image watermarks across PDF pages before you share or publish.",
    howToSteps: [
      "Upload the PDF to watermark.",
      "Configure text or image watermark settings.",
      "Download the watermarked PDF.",
    ],
    whyUse: [
      "Mark draft or confidential versions clearly.",
      "Add company branding to shared PDFs.",
      "Discourage unauthorised copying of preview documents.",
    ],
    keyFeatures: [
      "Text and image watermarks",
      "Adjustable placement and opacity",
      "Applies across pages",
      "Download ready-to-share PDF",
    ],
    faqs: [
      {
        question: "Can I watermark every page at once?",
        answer: "Yes. Watermarks can be applied across all pages in the document.",
      },
      {
        question: "Can I use my logo as a watermark?",
        answer: "Yes. Upload an image watermark such as a company logo.",
      },
    ],
    relatedToolIds: ["protect-pdf", "redact-pdf", "merge-pdf", "compress-pdf"],
    keywords: ["watermark pdf", "stamp pdf", "add watermark to pdf"],
  },
  "redact-pdf": {
    id: "redact-pdf",
    path: "/tools/redact-pdf",
    seoTitle: toolTitle("Redact PDF Online", "Permanently Hide Sensitive Text"),
    metaDescription:
      "Redact PDF content online. Permanently black out names, account numbers, and other sensitive text before sharing documents.",
    h1: "Redact PDF",
    pageDescription:
      "Permanently redact sensitive content from PDF documents before you share or publish them.",
    howToSteps: [
      "Upload the PDF containing sensitive information.",
      "Select text or areas to redact.",
      "Download the redacted PDF with content permanently removed.",
    ],
    whyUse: [
      "Share documents while hiding personal or financial details.",
      "Prepare FOIA, legal, or compliance copies safely.",
      "Remove sensitive strings permanently, not just visually.",
    ],
    keyFeatures: [
      "Permanent redaction",
      "Select text or regions",
      "Preview before export",
      "Safe sharing workflow",
    ],
    faqs: [
      {
        question: "Is redaction reversible?",
        answer: "No. Redacted content is permanently removed from the exported PDF.",
      },
      {
        question: "Can I redact scanned PDFs?",
        answer: "Yes. Draw redaction areas over sensitive regions in scanned pages.",
      },
    ],
    relatedToolIds: ["protect-pdf", "metadata-cleaner", "watermark-pdf", "compress-pdf", "crop-pdf"],
    keywords: ["redact pdf", "black out pdf text", "pdf redaction online"],
  },
  "metadata-cleaner": {
    id: "metadata-cleaner",
    path: "/tools/metadata-cleaner",
    seoTitle: toolTitle("Metadata Cleaner Online", "Remove Hidden File Metadata"),
    metaDescription:
      "Remove hidden EXIF and PDF metadata online. Strip author, location, and camera data before sharing images and documents.",
    h1: "Metadata Cleaner",
    pageDescription:
      "Strip EXIF and PDF metadata while preserving visible content — useful before sharing files publicly.",
    howToSteps: [
      "Upload an image or PDF file.",
      "Scanonix removes hidden metadata fields.",
      "Download the cleaned file.",
    ],
    whyUse: [
      "Avoid leaking location, author, or camera details from photos.",
      "Share documents without embedded creation history.",
      "Reduce privacy risk before publishing files online.",
    ],
    keyFeatures: [
      "Removes EXIF from images",
      "Strips PDF document properties",
      "Preserves visible content",
      "Quick privacy cleanup",
    ],
    faqs: [
      {
        question: "What metadata does this remove?",
        answer:
          "Common EXIF fields from images and document properties such as author and creation tool from PDFs.",
      },
      {
        question: "Will image quality change?",
        answer: "No. Only hidden metadata is removed; pixels stay the same.",
      },
    ],
    relatedToolIds: ["redact-pdf", "protect-pdf", "image-compressor", "compress-pdf"],
    keywords: ["remove metadata", "exif remover", "pdf metadata cleaner"],
  },
  "background-remover": {
    id: "background-remover",
    path: "/tools/background-remover",
    seoTitle: toolTitle("Remove Background from Image Online"),
    metaDescription:
      "Remove image backgrounds online and download a transparent PNG. Upload JPG, PNG, or WEBP — secure server-side cutout with before/after preview. HD free, 4K on Pro.",
    h1: "Remove Image Background Online",
    headerDescription:
      "Upload a JPG, PNG, or WEBP image and download a transparent-background PNG. Secure server-side processing with side-by-side preview.",
    pageDescription:
      "Remove the background from product photos, portraits, and graphics, then export a cutout with a transparent background. Scanonix processes your image on secure servers to generate the cutout.",
    howToSteps: [
      "Upload a JPG, PNG, or WEBP image.",
      "Wait for Scanonix to detect the subject and remove the background.",
      "Preview the cutout, then download a transparent PNG.",
    ],
    whyUse: [
      "Create product listings and profile photos with clean edges.",
      "Export a transparent PNG for slides, stores, and design tools.",
      "Preview the result before download with a before/after slider.",
      "Resize or compress the cutout afterward for web uploads.",
    ],
    useCases: [
      "Remove the background from a product photo for an online store.",
      "Cut out a portrait for a presentation or social profile image.",
      "Prepare a logo or graphic with a transparent background for slides.",
      "Clean up a photo before converting it to PDF or another format.",
    ],
    limitations: [
      "Supported uploads: JPG, JPEG, PNG, and WEBP up to 25 MB.",
      "Fine details such as hair, fur, or glass can be harder to cut cleanly.",
      "Busy backgrounds and low-contrast subjects may need a second attempt or manual touch-up elsewhere.",
      "4K export requires a Pro plan; HD export is available on Free.",
    ],
    keyFeatures: [
      "Secure server-side AI processing",
      "Before/after preview slider",
      "Transparent PNG download",
      "HD export on Free; 4K on Pro",
    ],
    faqs: [
      {
        question: "How do I remove the background from an image?",
        answer:
          "Upload your image, let Scanonix generate the cutout, preview the result, and download a PNG with a transparent background.",
      },
      {
        question: "Will I get a transparent background?",
        answer:
          "Yes. The standard download is a PNG with transparency around the subject.",
      },
      {
        question: "Which image formats can I upload?",
        answer: "JPG, JPEG, PNG, and WEBP files are supported.",
      },
      {
        question: "Is background removal done on my device?",
        answer:
          "No. Your image is uploaded and processed on Scanonix servers to generate the cutout. The result is returned for preview and download in your browser.",
      },
      {
        question: "What should I use after removing the background?",
        answer:
          "Try Image Resizer to fit platform dimensions or Image Compressor to reduce file size before uploading.",
      },
    ],
    relatedToolIds: ["image-resizer", "image-compressor", "png-to-jpg", "jpg-to-png"],
    keywords: [
      "remove background from image",
      "transparent background",
      "background remover online",
      "remove bg free",
    ],
  },
  "image-compressor": {
    id: "image-compressor",
    path: "/tools/image-compressor",
    seoTitle: toolTitle("Image Compressor Online", "Reduce Image File Size Free"),
    metaDescription:
      "Compress JPG, PNG, WEBP, and HEIC images online. Reduce file size with adjustable quality for web, email, and apps.",
    h1: "Image Compressor",
    pageDescription:
      "Compress JPG, PNG, WEBP, and HEIC images with adjustable quality settings for faster uploads and smaller attachments.",
    howToSteps: [
      "Upload the image you want to compress.",
      "Adjust quality or target size settings.",
      "Download the optimised image.",
    ],
    whyUse: [
      "Speed up website load times with smaller images.",
      "Fit photos into email and form upload limits.",
      "Batch-friendly compression for everyday workflows.",
    ],
    keyFeatures: [
      "JPG, PNG, WEBP, and HEIC support",
      "Adjustable quality control",
      "Before/after size preview",
      "Fast compression",
    ],
    faqs: [
      {
        question: "How much smaller will my image get?",
        answer: "Photo-heavy files often shrink significantly; already-optimised images may change less.",
      },
      {
        question: "Will compression ruin image quality?",
        answer: "You control quality level to balance size and visual fidelity.",
      },
    ],
    relatedToolIds: ["image-resizer", "background-remover", "png-to-jpg", "jpg-to-webp"],
    keywords: ["compress image", "reduce image size", "optimize image online"],
  },
  "image-resizer": {
    id: "image-resizer",
    path: "/tools/image-resizer",
    seoTitle: toolTitle("Image Resizer Online", "Resize Images to Exact Dimensions"),
    metaDescription:
      "Resize images online to exact pixel dimensions. Scale photos for web, social, and print with optional aspect ratio lock.",
    h1: "Image Resizer",
    pageDescription:
      "Resize images to exact pixel dimensions with optional aspect ratio lock for consistent output.",
    howToSteps: [
      "Upload your image.",
      "Enter target width and height or pick a preset.",
      "Download the resized image.",
    ],
    whyUse: [
      "Meet platform size requirements for listings and social posts.",
      "Create thumbnails without opening desktop software.",
      "Keep aspect ratio locked to avoid stretched photos.",
    ],
    keyFeatures: [
      "Exact pixel dimensions",
      "Aspect ratio lock",
      "Common format support",
      "Instant download",
    ],
    faqs: [
      {
        question: "Can I resize without cropping?",
        answer: "Yes. Lock aspect ratio to scale proportionally.",
      },
      {
        question: "Does resizing reduce quality?",
        answer: "Downscaling usually looks sharp; upscaling may soften details unless you use Image Upscaler.",
      },
    ],
    relatedToolIds: ["image-compressor", "image-upscaler", "png-to-jpg", "background-remover"],
    keywords: ["resize image", "scale image online", "change image dimensions"],
  },
  "image-upscaler": {
    id: "image-upscaler",
    path: "/tools/image-upscaler",
    seoTitle: toolTitle("Image Upscaler Online", "Enlarge Images 2× or 4×"),
    metaDescription:
      "Upscale images online 2× or 4× with high-quality Lanczos resampling. Improve resolution for print and display use.",
    h1: "Image Upscaler",
    pageDescription:
      "Upscale images 2× or 4× with high-quality Lanczos resampling for sharper enlargements.",
    howToSteps: [
      "Upload a JPG or PNG image.",
      "Choose 2× or 4× upscale factor.",
      "Download the higher-resolution image.",
    ],
    whyUse: [
      "Rescue small assets for larger display or print.",
      "Improve clarity before cropping or editing.",
      "Use Lanczos resampling for cleaner enlargements.",
    ],
    keyFeatures: [
      "2× and 4× upscale options",
      "Lanczos resampling",
      "JPG and PNG support",
      "Pro feature for heavy use",
    ],
    faqs: [
      {
        question: "Can upscaling recover lost detail?",
        answer: "Upscaling improves size and smoothness but cannot recreate detail that was never captured.",
      },
      {
        question: "Which images upscale best?",
        answer: "Simple graphics and moderately sized photos upscale more cleanly than tiny low-quality JPEGs.",
      },
    ],
    relatedToolIds: ["image-resizer", "image-compressor", "background-remover", "png-to-jpg"],
    keywords: ["image upscaler", "enlarge image", "increase image resolution"],
  },
  "png-to-jpg": {
    id: "png-to-jpg",
    path: "/tools/png-to-jpg",
    seoTitle: toolTitle("PNG to JPG Converter Online Free"),
    metaDescription:
      "Convert PNG to JPG online for smaller, widely compatible files. Adjust quality, flatten transparency, and download instantly in your browser.",
    h1: "Convert PNG to JPG Online",
    pageDescription:
      "Convert PNG images to JPG with Scanonix for smaller file sizes and broad compatibility across apps, email, and websites.",
    howToSteps: [
      "Upload a PNG image.",
      "Choose JPG quality and background colour if transparency is present.",
      "Download the converted JPG file.",
    ],
    whyUse: [
      "Reduce file size compared with lossless PNG.",
      "Share images where JPG is required by upload forms or apps.",
      "Prepare photos for email attachments with smaller payloads.",
      "Conversion runs locally in your browser.",
    ],
    keyFeatures: [
      "Fast PNG to JPG conversion",
      "Quality and background controls",
      "Works in the browser",
      "Instant download",
    ],
    faqs: [
      {
        question: "How do I convert PNG to JPG online?",
        answer:
          "Upload a PNG file, adjust quality if needed, and download the JPG output from your browser.",
      },
      { question: "Will transparency be kept?", answer: "JPG does not support transparency; transparent areas become a solid background colour." },
      { question: "Is PNG to JPG free?", answer: "Yes. Convert PNG files to JPG for free in your browser." },
      {
        question: "Will the JPG file be smaller than the PNG?",
        answer: "Usually yes, especially for photographic content, though results vary by image.",
      },
      {
        question: "Can I choose the background colour for transparent PNGs?",
        answer: "Yes. Pick a background colour before converting when your PNG has transparency.",
      },
    ],
    relatedToolIds: ["jpg-to-png", "png-to-webp", "image-compressor", "background-remover"],
    keywords: ["png to jpg", "png to jpeg", "convert png online", "png to jpg free"],
  },
  "jpg-to-png": {
    id: "jpg-to-png",
    path: "/tools/jpg-to-png",
    seoTitle: toolTitle("JPG to PNG Converter Online Free"),
    metaDescription:
      "Convert JPG to PNG online for lossless editing workflows. Optional resize and PNG output — processed locally in your browser.",
    h1: "Convert JPG to PNG Online",
    pageDescription:
      "Convert JPEG images to PNG with Scanonix for lossless editing, design workflows, and formats that preserve sharper edges.",
    howToSteps: [
      "Upload a JPG or JPEG image.",
      "Adjust resize options if needed.",
      "Download the PNG file.",
    ],
    whyUse: [
      "Switch to lossless PNG before editing in design tools.",
      "Avoid further JPEG compression artifacts during rework.",
      "Prepare images for workflows that require PNG input.",
      "Convert locally without installing desktop software.",
    ],
    keyFeatures: [
      "JPEG and JPG support",
      "Optional resize",
      "Browser-based conversion",
      "Quick download",
    ],
    faqs: [
      {
        question: "How do I convert JPG to PNG online?",
        answer:
          "Upload a JPG or JPEG file and download the converted PNG from your browser.",
      },
      { question: "Will PNG files be larger?", answer: "Often yes, because PNG is lossless compared with JPG." },
      { question: "Can I convert iPhone photos?", answer: "Yes, if they are JPG/JPEG. For HEIC, use HEIC to JPG first." },
      {
        question: "Does converting JPG to PNG improve quality?",
        answer:
          "PNG prevents further loss, but it cannot restore detail already lost in the original JPG compression.",
      },
      {
        question: "Is JPG to PNG free?",
        answer: "Yes. JPG to PNG conversion is free in your browser.",
      },
    ],
    relatedToolIds: ["png-to-jpg", "heic-to-jpg", "png-to-webp", "image-compressor"],
    keywords: ["jpg to png", "jpeg to png", "convert jpg online", "jpg to png free"],
  },
  "png-to-webp": {
    id: "png-to-webp",
    path: "/tools/png-to-webp",
    seoTitle: toolTitle("PNG to WEBP Online", "Convert PNG to WEBP Free"),
    metaDescription:
      "Convert PNG to WEBP online for smaller web images with transparency support. Fast browser-based conversion.",
    h1: "PNG to WEBP",
    pageDescription: "Convert PNG to WEBP for efficient web delivery while keeping transparency where supported.",
    howToSteps: ["Upload a PNG file.", "Convert to WEBP format.", "Download the optimised WEBP image."],
    whyUse: ["Reduce page weight for websites.", "Keep transparency in a modern web format.", "Speed up image-heavy pages."],
    keyFeatures: ["PNG to WEBP conversion", "Smaller web file sizes", "Browser processing", "Instant download"],
    faqs: [
      { question: "Why use WEBP instead of PNG?", answer: "WEBP often produces smaller files with similar visual quality." },
      { question: "Do all browsers support WEBP?", answer: "All modern browsers support WEBP; use JPG fallback if needed." },
    ],
    relatedToolIds: ["webp-to-png", "jpg-to-webp", "png-to-jpg", "image-compressor"],
    keywords: ["png to webp", "convert png webp", "webp converter"],
  },
  "jpg-to-webp": {
    id: "jpg-to-webp",
    path: "/tools/jpg-to-webp",
    seoTitle: toolTitle("JPG to WEBP Online", "Convert JPEG to WEBP Free"),
    metaDescription:
      "Convert JPG to WEBP online for faster page loads and smaller image files. Simple upload-and-download workflow.",
    h1: "JPG to WEBP",
    pageDescription: "Convert JPG photos to WEBP for faster page loads and smaller image assets.",
    howToSteps: ["Upload a JPG image.", "Convert to WEBP.", "Download the WEBP file."],
    whyUse: ["Improve website performance.", "Keep good visual quality at smaller sizes.", "Modernise image assets for the web."],
    keyFeatures: ["JPG and JPEG support", "Efficient WEBP output", "Fast conversion", "No install required"],
    faqs: [
      { question: "Is JPG to WEBP good for photos?", answer: "Yes. WEBP is well suited to photographic content on the web." },
      { question: "Can I convert back to JPG?", answer: "Use the WEBP to JPG tool if you need a JPG again." },
    ],
    relatedToolIds: ["webp-to-jpg", "png-to-webp", "image-compressor", "jpg-to-png"],
    keywords: ["jpg to webp", "jpeg to webp", "convert jpg webp online"],
  },
  "webp-to-jpg": {
    id: "webp-to-jpg",
    path: "/tools/webp-to-jpg",
    seoTitle: toolTitle("WEBP to JPG Online", "Convert WEBP to JPEG Free"),
    metaDescription:
      "Convert WEBP to JPG online for compatibility with older apps, email, and print workflows.",
    h1: "WEBP to JPG",
    pageDescription: "Convert WEBP images to widely supported JPG files for sharing and editing.",
    howToSteps: ["Upload a WEBP image.", "Convert to JPG format.", "Download the JPG file."],
    whyUse: ["Open WEBP files in apps that only accept JPG.", "Attach images to systems with strict format rules.", "Prepare web images for print."],
    keyFeatures: ["WEBP input support", "Universal JPG output", "Browser-based", "Instant download"],
    faqs: [
      { question: "Will quality change when converting WEBP to JPG?", answer: "JPG is lossy, so a small quality change is possible depending on settings." },
      { question: "Can I batch convert WEBP files?", answer: "Convert files one at a time in the current tool workflow." },
    ],
    relatedToolIds: ["jpg-to-webp", "webp-to-png", "png-to-jpg", "image-compressor"],
    keywords: ["webp to jpg", "webp to jpeg", "convert webp online"],
  },
  "webp-to-png": {
    id: "webp-to-png",
    path: "/tools/webp-to-png",
    seoTitle: toolTitle("WEBP to PNG Online", "Convert WEBP to PNG Free"),
    metaDescription:
      "Convert WEBP to PNG online for lossless editing and design workflows. Quick browser-based conversion.",
    h1: "WEBP to PNG",
    pageDescription: "Convert WEBP images to PNG for editing workflows that need a lossless format.",
    howToSteps: ["Upload a WEBP file.", "Convert to PNG.", "Download the PNG image."],
    whyUse: ["Edit WEBP assets in PNG-friendly design tools.", "Preserve sharper edges for graphics.", "Avoid compatibility issues with older software."],
    keyFeatures: ["WEBP to PNG conversion", "Lossless PNG output", "Fast processing", "No software install"],
    faqs: [
      { question: "When should I choose PNG over JPG?", answer: "Use PNG for graphics, screenshots, and images that need lossless editing." },
      { question: "Does WEBP transparency carry over?", answer: "PNG supports transparency, so transparent WEBP images can remain transparent." },
    ],
    relatedToolIds: ["png-to-webp", "webp-to-jpg", "jpg-to-png", "image-compressor"],
    keywords: ["webp to png", "convert webp png online"],
  },
  "heic-to-jpg": {
    id: "heic-to-jpg",
    path: "/tools/heic-to-jpg",
    seoTitle: toolTitle("HEIC to JPG Online", "High-Quality iPhone Photo Conversion"),
    metaDescription:
      "Convert HEIC to JPG online with adjustable quality. Open iPhone and Apple photos on any device — local browser conversion with instant download.",
    h1: "Convert HEIC to JPG with High Visual Quality",
    pageDescription:
      "Turn HEIC and HEIF photos from iPhone or Apple devices into widely compatible JPG files. Adjust output quality before download to keep strong visual detail where possible.",
    howToSteps: [
      "Upload a HEIC or HEIF photo from your iPhone or camera roll.",
      "Set JPG quality if you want a smaller file or higher detail.",
      "Download the converted JPG file.",
    ],
    whyUse: [
      "Open iPhone photos on Windows, Android, and apps that do not support HEIC.",
      "Attach photos to email, forms, and websites that require JPG.",
      "Control output quality before converting to JPG.",
      "Convert locally in your browser without installing desktop software.",
    ],
    useCases: [
      "Share an iPhone photo in a chat app that only accepts JPG.",
      "Upload Apple camera photos to a job application or government portal.",
      "Send vacation photos to family members on older Android phones.",
      "Prepare HEIC images for editing tools that expect JPEG input.",
    ],
    limitations: [
      "JPG is a lossy format, so some detail may change compared with the original HEIC.",
      "Higher quality settings preserve more visual detail but produce larger files.",
      "HEIC transparency or depth data is not carried over to JPG.",
      "Convert one file at a time in the current workflow.",
    ],
    keyFeatures: [
      "HEIC and HEIF input support",
      "Adjustable JPG quality",
      "Local browser processing",
      "Instant download",
    ],
    faqs: [
      {
        question: "Can I convert HEIC to JPG without losing quality?",
        answer:
          "JPG compression always changes the file slightly. Use a higher quality setting to keep strong visual detail, but expect a larger output file.",
      },
      {
        question: "Why can't I open HEIC files on Windows?",
        answer:
          "HEIC is Apple's efficient capture format. JPG is supported almost everywhere, which makes sharing and uploading easier.",
      },
      {
        question: "Does conversion happen on my device?",
        answer:
          "Yes. Standard HEIC to JPG conversion runs locally in your browser.",
      },
      {
        question: "Should I choose HEIC to PNG instead?",
        answer:
          "Choose PNG when you need lossless editing. Choose JPG when you need smaller files and broad compatibility.",
      },
      {
        question: "What can I do after converting to JPG?",
        answer:
          "Use Image Compressor to reduce file size further, or Image to PDF if you need to combine photos into one document.",
      },
    ],
    relatedToolIds: ["image-compressor", "image-to-pdf", "heic-to-png", "jpg-to-png"],
    keywords: [
      "heic to jpg",
      "heic to jpg without losing quality",
      "iphone photo converter",
      "heic to jpeg online",
    ],
  },
  "heic-to-png": {
    id: "heic-to-png",
    path: "/tools/heic-to-png",
    seoTitle: toolTitle("HEIC to PNG Online", "Convert HEIC Images Free"),
    metaDescription:
      "Convert HEIC to PNG online for lossless editing. Turn iPhone HEIC photos into PNG files in seconds.",
    h1: "HEIC to PNG",
    pageDescription: "Convert HEIC images to PNG for lossless editing and design workflows.",
    howToSteps: ["Upload a HEIC image.", "Convert to PNG format.", "Download the PNG file."],
    whyUse: ["Edit iPhone photos in PNG-friendly tools.", "Avoid compatibility issues with HEIC on desktop apps.", "Keep a lossless copy for design work."],
    keyFeatures: ["HEIC support", "Lossless PNG output", "Quick conversion", "No install required"],
    faqs: [
      { question: "Is HEIC to PNG better than HEIC to JPG?", answer: "Choose PNG for editing; choose JPG for smaller shareable files." },
      { question: "Can I convert multiple HEIC files?", answer: "Convert one file at a time in the current workflow." },
    ],
    relatedToolIds: ["heic-to-jpg", "jpg-to-png", "png-to-jpg", "image-compressor"],
    keywords: ["heic to png", "convert heic online"],
  },
  ocr: {
    id: "ocr",
    path: "/tools/ocr",
    seoTitle: toolTitle("OCR Online", "Extract Text from Images & PDFs"),
    metaDescription:
      "Extract text from scanned PDFs and images with online OCR. Choose a language, recognise text in your browser, then copy or download the result.",
    h1: "Extract Text from Scanned PDFs and Images",
    headerDescription:
      "Turn scanned PDF pages and photos into editable text. Upload a file, choose the language, and copy or download the OCR result from your browser.",
    pageDescription:
      "Pull readable text from scanned PDF pages, phone photos, and image files. Select the document language, run OCR locally in your browser, and copy or download the extracted text.",
    howToSteps: [
      "Upload a scanned PDF, photo, or image file.",
      "Choose the language printed in the document.",
      "Run OCR, then copy or download the extracted text.",
    ],
    whyUse: [
      "Recover text from scanned contracts, forms, and receipts.",
      "Search or quote content trapped inside image-only PDF pages.",
      "Avoid retyping printed documents line by line.",
      "Use the output with PDF to Word when you need an editable document.",
    ],
    useCases: [
      "Extract text from a scanned multi-page PDF for editing or quoting.",
      "Digitise a photographed whiteboard or handwritten meeting notes page.",
      "Copy text from a screenshot of a printed invoice or letter.",
      "Prepare OCR output before translation or summarisation in other Scanonix tools.",
    ],
    limitations: [
      "OCR works best on clear, printed text. Handwriting and low-contrast scans are harder to read accurately.",
      "Skewed, blurry, or heavily compressed images reduce recognition quality.",
      "Complex page layouts may extract text out of visual reading order.",
      "OCR returns text content — it does not rebuild the original PDF layout.",
    ],
    keyFeatures: [
      "Scanned PDF and image support",
      "Multiple language selection",
      "Local browser OCR via Tesseract.js",
      "Copy or download extracted text",
    ],
    faqs: [
      {
        question: "Can OCR extract text from an image?",
        answer:
          "Yes. Upload a photo or screenshot of printed text, select the language, and Scanonix returns the recognised text.",
      },
      {
        question: "How do I extract text from a scanned PDF?",
        answer:
          "Upload the scanned PDF or page image, select the correct language, and run OCR. Scanonix returns the recognised text for copying or download.",
      },
      {
        question: "Can OCR read text from a photo?",
        answer:
          "Yes. Clear photos of printed documents, signs, or pages work well. Blurry or angled shots may reduce accuracy.",
      },
      {
        question: "Does Scanonix OCR run online in the cloud?",
        answer:
          "Recognition runs locally in your browser using Tesseract.js, so your file stays on your device during processing.",
      },
      {
        question: "Will OCR work on handwriting?",
        answer:
          "Handwriting support is limited. Printed text, typed forms, and clean scans give the most reliable results.",
      },
      {
        question: "What should I use after extracting text from a scan?",
        answer:
          "Use PDF to Word if you need an editable document file, or AI Translate if you need the extracted text in another language.",
      },
    ],
    relatedToolIds: ["pdf-to-word", "ai-translate", "image-to-pdf", "compress-pdf"],
    keywords: [
      "extract text from scanned pdf",
      "image to text",
      "online ocr",
      "extract text from image",
    ],
  },
  "ai-translate": {
    id: "ai-translate",
    path: "/tools/ai-translate",
    seoTitle: toolTitle("AI Language Translator Online"),
    metaDescription:
      "Translate text and document excerpts online with Scanonix AI. Convert content between major languages while preserving meaning — Pro feature with usage limits.",
    h1: "AI Language Translator Online",
    pageDescription:
      "Translate text between major world languages with Scanonix AI. Paste content or use OCR output, choose languages, and review natural translations in seconds.",
    howToSteps: [
      "Paste or upload the text you want to translate.",
      "Choose source and target languages.",
      "Review and copy or download the translated text.",
    ],
    whyUse: [
      "Translate document excerpts without switching apps.",
      "Reach international readers with natural phrasing.",
      "Handle multilingual content in one workspace.",
      "Combine with OCR when working from scanned source material.",
    ],
    keyFeatures: [
      "Major world languages",
      "Preserves meaning and tone",
      "Works with pasted or extracted text",
      "Fast AI translation",
    ],
    faqs: [
      {
        question: "How does the AI Language Translator work?",
        answer:
          "Paste text, choose source and target languages, and Scanonix returns a translated version using cloud AI.",
      },
      {
        question: "Can I translate scanned documents?",
        answer: "Run OCR first to extract text, then translate the extracted content.",
      },
      {
        question: "Is AI translation perfect?",
        answer: "It is strong for general content, but review legal or technical text before publishing.",
      },
      {
        question: "Which languages are supported?",
        answer:
          "Scanonix supports major world languages. Check the language selector in the tool for the current list.",
      },
      {
        question: "Do I need a Pro plan to translate?",
        answer:
          "AI translation is a Pro feature. Free users can upgrade for access and higher usage limits.",
      },
    ],
    relatedToolIds: ["ocr", "ai-summary", "ai-rewrite", "pdf-to-word"],
    keywords: ["ai translator", "translate document online", "language translator", "ai translate text"],
  },
  "ai-summary": {
    id: "ai-summary",
    path: "/tools/ai-summary",
    seoTitle: toolTitle("AI Document Summary Online", "Summarise Text Free"),
    metaDescription:
      "Summarise long documents online with AI. Turn lengthy reports, articles, and OCR text into concise summaries quickly.",
    h1: "AI Document Summary",
    pageDescription:
      "Summarise long documents and OCR text with cloud AI to capture key points in seconds.",
    howToSteps: [
      "Paste text or provide document content.",
      "Choose summary length if available.",
      "Review the generated summary and copy or export it.",
    ],
    whyUse: [
      "Grasp long reports without reading every page.",
      "Create meeting notes from dense documents.",
      "Summarise OCR output from scanned files.",
    ],
    keyFeatures: [
      "Handles long-form text",
      "Works with OCR output",
      "Adjustable summary depth",
      "Fast AI processing",
    ],
    faqs: [
      {
        question: "What documents can be summarised?",
        answer: "Text content, including OCR output from scans, can be summarised.",
      },
      {
        question: "Should I verify AI summaries?",
        answer: "Yes. Review summaries before using them for decisions or publication.",
      },
    ],
    relatedToolIds: ["ocr", "ai-translate", "ai-rewrite", "pdf-to-word"],
    keywords: ["ai summary", "summarize document online", "document summary tool"],
  },
  "ai-rewrite": {
    id: "ai-rewrite",
    path: "/tools/ai-rewrite",
    seoTitle: toolTitle("AI Rewrite Online", "Paraphrase & Improve Text"),
    metaDescription:
      "Rewrite and paraphrase text online with AI. Change tone, shorten or expand content, and improve clarity in seconds.",
    h1: "AI Rewrite",
    pageDescription:
      "Rewrite text in different tones and lengths with cloud AI while keeping your original meaning.",
    howToSteps: [
      "Paste the text you want to rewrite.",
      "Choose tone or rewrite style.",
      "Copy the rewritten version.",
    ],
    whyUse: [
      "Refresh drafts without starting from scratch.",
      "Adjust tone for different audiences.",
      "Shorten or expand content quickly.",
    ],
    keyFeatures: [
      "Multiple rewrite tones",
      "Meaning-preserving paraphrase",
      "Fast AI output",
      "Pro feature for heavy use",
    ],
    faqs: [
      {
        question: "Will AI rewrite change my facts?",
        answer: "Review output carefully, especially for technical, legal, or numeric content.",
      },
      {
        question: "Can I rewrite non-English text?",
        answer: "Yes for many languages, though results vary by language and context.",
      },
    ],
    relatedToolIds: ["ai-translate", "ai-summary", "ocr", "pdf-to-word"],
    keywords: ["ai rewrite", "paraphrase online", "rewrite text ai"],
  },
  "qr-scanner": {
    id: "qr-scanner",
    path: "/tools/qr-scanner",
    seoTitle: toolTitle("QR Scanner Online", "Scan QR Codes from Camera or Image"),
    metaDescription:
      "Scan QR codes online using your camera or an uploaded image. Decode links, text, and contact details instantly in your browser.",
    h1: "QR Scanner",
    pageDescription:
      "Scan QR codes with your camera or upload an image to decode links and text instantly.",
    howToSteps: [
      "Allow camera access or upload a QR code image.",
      "Point the camera at the code or select the image.",
      "Copy or open the decoded result.",
    ],
    whyUse: [
      "Decode QR codes on desktop without a phone app.",
      "Extract links from QR images shared in chat or email.",
      "Works locally for quick everyday scanning.",
    ],
    keyFeatures: [
      "Camera and image upload modes",
      "Instant decode",
      "Local processing",
      "Copy decoded content",
    ],
    faqs: [
      {
        question: "Do I need to install an app?",
        answer: "No. Scanonix QR Scanner runs in your browser.",
      },
      {
        question: "Can it scan blurry QR images?",
        answer: "Clear, well-lit codes work best; very blurry images may fail to decode.",
      },
    ],
    relatedToolIds: ["ocr", "metadata-cleaner", "image-compressor", "ai-translate"],
    keywords: ["qr scanner online", "scan qr code", "qr decoder"],
  },
  "security-scan": {
    id: "security-scan",
    path: "/tools/security-scan",
    seoTitle: toolTitle("Website Security Scan Online", "Check URLs for Threats"),
    metaDescription:
      "Check websites for malware, phishing, and security risks online. Scan URLs and review saved reports in your Scanonix account.",
    h1: "Website Security Scan",
    pageDescription:
      "Check any URL for malware, phishing, and common security risks. Results can be saved to your scan history.",
    howToSteps: [
      "Sign in or create a free Scanonix account if prompted.",
      "Enter the website URL you want to check.",
      "Review the scan report and save it to history if needed.",
    ],
    whyUse: [
      "Verify unfamiliar links before clicking or sharing.",
      "Review website risk signals in one workspace.",
      "Keep scan history for recurring checks.",
    ],
    keyFeatures: [
      "URL threat checks",
      "Risk scoring and report details",
      "Saved scan history",
      "Part of Scanonix Security tools",
    ],
    faqs: [
      {
        question: "Is this the main purpose of Scanonix?",
        answer:
          "No. Scanonix is primarily a free online toolkit for PDF, image, and AI document tools. Website scanning is one optional security tool.",
      },
      {
        question: "Do I need an account to scan a website?",
        answer: "An account helps save reports and history; follow the on-page prompts for access.",
      },
    ],
    relatedToolIds: ["metadata-cleaner", "protect-pdf", "redact-pdf", "qr-scanner"],
    keywords: ["website security scan", "url scanner", "check link safety"],
  },
  image: {
    id: "image",
    path: "/tools/image",
    seoTitle: toolTitle("Image Tools Online", "Convert, Compress & Edit Images"),
    metaDescription:
      "Browse Scanonix image tools online — convert PNG, JPG, WEBP, and HEIC, remove backgrounds, compress, resize, and upscale images.",
    h1: "Image Tools",
    pageDescription:
      "Convert PNG, JPG, WEBP, and HEIC images, remove backgrounds, and prepare files for the web in one place.",
    howToSteps: [
      "Browse the image tool you need.",
      "Open the tool and upload your file.",
      "Download the converted or edited result.",
    ],
    whyUse: [
      "Find every image converter and editor without searching multiple sites.",
      "Use consistent privacy-first workflows across tools.",
      "Jump between compression, conversion, and background removal quickly.",
    ],
    keyFeatures: [
      "Format converters for PNG, JPG, WEBP, and HEIC",
      "Background remover and compressor",
      "Resize and upscale utilities",
      "All tools linked from one hub",
    ],
    faqs: [
      {
        question: "Which image tool should I use first?",
        answer: "Use HEIC to JPG for iPhone photos, Background Remover for cutouts, and Image Compressor to reduce size.",
      },
      {
        question: "Are image tools free?",
        answer: "Many tools are free with daily limits; Pro unlocks higher limits and advanced features.",
      },
    ],
    relatedToolIds: ["background-remover", "png-to-jpg", "heic-to-jpg", "image-compressor"],
    keywords: ["image tools online", "image converter", "background remover"],
  },
};

/** Public indexable tool paths for sitemap generation. */
export const INDEXABLE_TOOL_PATHS: string[] = Object.values(TOOL_SEO).map(
  (tool) => tool.path,
);

export function getToolSeo(toolId: string): ToolSeoEntry {
  const entry = TOOL_SEO[toolId];
  if (!entry) {
    throw new Error(`Missing SEO config for tool: ${toolId}`);
  }
  return entry;
}

export function getRelatedTools(toolId: string): ToolSeoEntry[] {
  const entry = getToolSeo(toolId);
  return entry.relatedToolIds
    .map((id) => TOOL_SEO[id])
    .filter((tool): tool is ToolSeoEntry => Boolean(tool));
}
