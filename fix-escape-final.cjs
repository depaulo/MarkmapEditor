const fs = require('fs');
let content = fs.readFileSync('js/workspace/workspace-sidebar.js', 'utf8');

const oldCode = `export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}`;

const newCode = `export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync('js/workspace/workspace-sidebar.js', content);
  console.log('Fixed escapeHtml successfully');
} else {
  console.log('Pattern not found - checking current state...');
  const match = content.match(/export function escapeHtml\(text\) \{[\s\S]*?\n\}/);
  if (match) {
    console.log('Found escapeHtml but pattern differs');
  } else {
    console.log('escapeHtml function not found');
  }
}