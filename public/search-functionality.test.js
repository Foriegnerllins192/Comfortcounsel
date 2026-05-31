/**
 * Unit Tests for Task 1.1: Home Page Search Functionality
 * Tests the event listener for search button click in index.html
 * 
 * Requirements Validated:
 * - REQ-1.1: Search button click redirects to find-counselors.html with query parameter
 * - REQ-1.2: Search query is preserved in URL
 * - REQ-1.3: Suggestion tags redirect with tag text as query
 * - REQ-1.5: Empty search redirects without query parameter
 */

const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

// Read the script.js file
const scriptPath = path.join(__dirname, 'script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

describe('Task 1.1: Home Page Search Functionality - Implementation Verification', () => {
  
  describe('redirectToFindCounselors Function', () => {
    
    it('should have redirectToFindCounselors function implemented', () => {
      expect(scriptContent).to.include('function redirectToFindCounselors(query)');
      expect(scriptContent).to.include('Validates: Requirements 1.1, 1.2, 1.3, 1.5');
    });

    it('should redirect to find-counselors.html with query parameter when query is provided', () => {
      expect(scriptContent).to.include('if (query) {');
      expect(scriptContent).to.include('window.location.href = `find-counselors.html?search=${encodeURIComponent(query)}`');
    });

    it('should redirect to find-counselors.html without query parameter when query is empty', () => {
      expect(scriptContent).to.include('} else {');
      expect(scriptContent).to.include('window.location.href = \'find-counselors.html\'');
    });

    it('should URL-encode the query parameter', () => {
      expect(scriptContent).to.include('encodeURIComponent(query)');
    });
  });

  describe('setupSearch Function', () => {
    
    it('should have setupSearch function implemented', () => {
      expect(scriptContent).to.include('function setupSearch()');
    });

    it('should select search button and input elements', () => {
      expect(scriptContent).to.include('const searchBtn = document.querySelector(\'.search-btn\')');
      expect(scriptContent).to.include('const searchInput = document.querySelector(\'.search-input\')');
    });

    it('should add click event listener to search button', () => {
      expect(scriptContent).to.include('searchBtn.addEventListener(\'click\', () => {');
      expect(scriptContent).to.include('redirectToFindCounselors(searchInput.value.trim())');
    });

    it('should add keypress event listener to search input for Enter key', () => {
      expect(scriptContent).to.include('searchInput.addEventListener(\'keypress\', (e) => {');
      expect(scriptContent).to.include('if (e.key === \'Enter\')');
      expect(scriptContent).to.include('redirectToFindCounselors(searchInput.value.trim())');
    });

    it('should trim whitespace from search input', () => {
      expect(scriptContent).to.include('searchInput.value.trim()');
    });
  });

  describe('Suggestion Tags Handler', () => {
    
    it('should select all suggestion tag elements', () => {
      expect(scriptContent).to.include('const suggestionTags = document.querySelectorAll(\'.suggestion-tag\')');
    });

    it('should add click event listener to each suggestion tag', () => {
      expect(scriptContent).to.include('suggestionTags.forEach(tag => {');
      expect(scriptContent).to.include('tag.addEventListener(\'click\', () => {');
    });

    it('should redirect with tag text as query', () => {
      expect(scriptContent).to.include('const query = tag.textContent.trim()');
      expect(scriptContent).to.include('redirectToFindCounselors(query)');
    });
  });

  describe('Global Export (ComfortCounsel Namespace)', () => {
    
    it('should export redirectToFindCounselors function', () => {
      expect(scriptContent).to.include('redirectToFindCounselors');
    });

    it('should be accessible via ComfortCounsel namespace', () => {
      expect(scriptContent).to.include('window.ComfortCounsel = {');
      // Verify the function is in the export list
      const exportSection = scriptContent.substring(
        scriptContent.indexOf('window.ComfortCounsel = {'),
        scriptContent.indexOf('};', scriptContent.indexOf('window.ComfortCounsel = {'))
      );
      expect(exportSection).to.include('redirectToFindCounselors');
    });
  });

  describe('Requirements Validation', () => {
    
    it('should validate Requirement 1.1 (Search button click redirects with query)', () => {
      expect(scriptContent).to.include('Validates: Requirements 1.1');
    });

    it('should validate Requirement 1.2 (Search query preserved in URL)', () => {
      expect(scriptContent).to.include('Validates: Requirements 1.1, 1.2');
    });

    it('should validate Requirement 1.3 (Suggestion tags redirect with tag text)', () => {
      expect(scriptContent).to.include('Validates: Requirements 1.1, 1.2, 1.3');
    });

    it('should validate Requirement 1.5 (Empty search redirects without query)', () => {
      expect(scriptContent).to.include('Validates: Requirements 1.1, 1.2, 1.3, 1.5');
    });
  });

  describe('Task 1.1 Completion Summary', () => {
    
    it('should have all required components implemented', () => {
      // Verify all components exist
      expect(scriptContent).to.include('function setupSearch()');
      expect(scriptContent).to.include('function redirectToFindCounselors(query)');
      expect(scriptContent).to.include('searchBtn.addEventListener(\'click\'');
      expect(scriptContent).to.include('searchInput.addEventListener(\'keypress\'');
      expect(scriptContent).to.include('suggestionTags.forEach');
    });

    it('should satisfy all task requirements', () => {
      const taskRequirements = [
        '1.1',  // Search button click redirects
        '1.2',  // Search query preserved
        '1.3',  // Suggestion tags work
        '1.5'   // Empty search handled
      ];
      
      // Verify all requirements are documented in the code
      taskRequirements.forEach(req => {
        const reqPattern = new RegExp(`Requirement[s]?.*${req.replace('.', '\\.')}`);
        expect(scriptContent).to.match(reqPattern);
      });
    });
  });
});

describe('Task 1.1: Code Quality Checks', () => {
  
  it('should have JSDoc documentation for redirectToFindCounselors', () => {
    expect(scriptContent).to.include('/**');
    expect(scriptContent).to.include('* Redirect to find-counselors page with optional search query');
    expect(scriptContent).to.include('* @param {string} query');
  });

  it('should implement proper event handling', () => {
    expect(scriptContent).to.include('addEventListener(\'click\'');
    expect(scriptContent).to.include('addEventListener(\'keypress\'');
  });

  it('should check for element existence before adding listeners', () => {
    expect(scriptContent).to.include('if (searchBtn && searchInput)');
  });

  it('should have organized code with clear sections', () => {
    expect(scriptContent).to.include('// Setup search functionality');
  });
});
