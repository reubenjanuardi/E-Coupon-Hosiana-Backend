import { PDFDocument } from 'pdf-lib';

/**
 * Merge multiple PDF buffers into a single PDF.
 * @param {Buffer[]} pdfBuffers - Array of PDF buffers to merge.
 * @returns {Promise<Buffer>} - The merged PDF as a Buffer.
 */
export const mergePdfs = async (pdfBuffers) => {
  try {
    const mergedPdf = await PDFDocument.create();

    for (const pdfBuffer of pdfBuffers) {
      const pdf = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
  } catch (error) {
    console.error('Error merging PDFs:', error);
    throw new Error('Failed to merge PDFs');
  }
};
