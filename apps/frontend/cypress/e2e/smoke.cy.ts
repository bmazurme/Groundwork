describe('dashboard smoke', () => {
  it('loads the app and reaches a healthy backend', () => {
    cy.visit('/');

    cy.contains('Groundwork').should('be.visible');

    // The health label starts as "checking backend…" and flips once the
    // /api/health request against the real Postgres-backed backend resolves.
    cy.contains('backend ok', { timeout: 30000 }).should('be.visible');

    cy.contains('Document library').should('be.visible');
    cy.contains('Grounded search').should('be.visible');
    cy.get('input[placeholder="Ask a question about your documents…"]').should('be.visible');
  });
});
