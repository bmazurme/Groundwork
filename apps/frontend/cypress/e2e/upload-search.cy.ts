const FIXTURE_NAME = 'sample-doc.md';
const MARKER = 'zzqx-cypress-marker';

describe('upload → index → search', () => {
  it('indexes an uploaded document and finds it via hybrid search', () => {
    cy.visit('/');
    cy.contains('backend ok', { timeout: 30000 }).should('be.visible');

    cy.get('input[type=file]').selectFile(`cypress/fixtures/${FIXTURE_NAME}`, { force: true });
    cy.contains(`"${FIXTURE_NAME}" uploaded`, { timeout: 15000 }).should('be.visible');

    // Indexing runs parse → chunk → embed on a real BullMQ worker; the table
    // polls every 2s while the row is pending/indexing, so this can take a
    // while on a cold ONNX model download.
    cy.contains('tr', FIXTURE_NAME, { timeout: 180000 }).within(() => {
      cy.contains('indexed', { timeout: 180000 }).should('be.visible');
    });

    cy.get('input[placeholder="Ask a question about your documents…"]').type(MARKER);
    cy.contains('button', 'Search').click();

    cy.contains(FIXTURE_NAME, { timeout: 15000 }).should('be.visible');
    cy.contains(MARKER).should('be.visible');
  });
});
