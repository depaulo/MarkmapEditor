const fs = require('fs');
let content = fs.readFileSync('js/workspace/workspace-sidebar.js', 'utf8');

// Simple string replacements - no regex quoting issues
content = content.replace(".replace(/&/g, '&')", ".replace(/&/g, '&')");
content = content.replace(".replace(/</g, '<')", ".replace(/</g, '<')");
content = content.replace(".replace(/>/g, '>')", ".replace(/>/g, '>')");
content = content.replace('.replace(/"/g, \'"\')', ".replace(/\"/g, '"')");

fs.writeFileSync('js/workspace/workspace-sidebar.js', content);
console.log('Fixed escapeHtml');