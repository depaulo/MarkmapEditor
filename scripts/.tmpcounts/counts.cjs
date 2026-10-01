const fs=require('fs'),path=require('path');
const ROOT='/data/data/com.termux/files/home/storage/downloads/Mme/MarkmapEditor';
const read=(...p)=>fs.readFileSync(path.join(ROOT,...p),'utf8');
const MAIN_SOURCE=read('js','main.js');
function extractBlockFrom(src,startMarker,endLine){
  endLine=endLine||'}';
  const s=src.indexOf(startMarker);
  if(s===-1)throw new Error('miss '+startMarker);
  let ls=src.indexOf('\n',s)+1;
  while(ls<=src.length){
    const nl=src.indexOf('\n',ls);
    const le=nl===-1?src.length:nl;
    if(src.slice(ls,le)===endLine)return src.slice(s,le);
    if(nl===-1)break;ls=nl+1;
  }
  throw new Error('unclosed '+startMarker);
}
const H=['function normalizeParserText(value) {','function stripMarkdownHeadingPrefix(line) {','function countWords(text) {','function normalizeTagValue(value) {','function parseMarkdownHeadings(text) {','function removeFencedCodeBlocks(text) {','function getMarkdownTitle(text, fallback','function stripYamlFrontmatterForTags(text) {','function normalizeMetadataKey(key) {','function parseMmeTaskMetadata(rawLine) {','function cleanTaskText(rawMatch3) {','function parseMarkdownTasks(text) {','function normalizeConceptName(value) {','function parseConceptLinks(text) {','function parseVisibleHeaderFields(text) {'];
globalThis.addEventListener=()=>{};
globalThis.removeEventListener=()=>{};
globalThis.document={getElementById:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},setAttribute(){},appendChild(){}})};
globalThis.window=globalThis;
(0,eval)(read('js','links','wiki-link-grammar.js'));
(0,eval)(read('js','links','wiki-links.js'));
const CTRL=read('js','workspace','workspace-controller.js');
(0,eval)([extractBlockFrom(CTRL,'function normalizeWorkspaceKindForCompare(')].concat(H.map(m=>extractBlockFrom(MAIN_SOURCE,m))).join('\n'));
(0,eval)(read('js','workspace','workspace-parser.js'));
const FALLBACK='const CURRENT_DOCUMENT_FALLBACK_NAME = "untitled.md";\nconst CURRENT_DOCUMENT_FALLBACK_PATH = "";';
(0,eval)([extractBlockFrom(MAIN_SOURCE,'const MME_SCOPE_IDS = Object.freeze({','});'),extractBlockFrom(MAIN_SOURCE,'const MME_AVAILABILITY = Object.freeze({','});'),extractBlockFrom(MAIN_SOURCE,'function resolveSavedIndexSnapshot(indexSnapshot) {'),extractBlockFrom(MAIN_SOURCE,'function getCurrentDocumentWorkspaceContext(documentScope) {'),extractBlockFrom(MAIN_SOURCE,'function getCurrentDocumentTagsProjection(documentScope) {'),extractBlockFrom(MAIN_SOURCE,'function getCurrentDocumentTasksProjection(documentScope) {'),extractBlockFrom(MAIN_SOURCE,'function getCurrentDocumentLinksOutProjection(documentScope, indexSnapshot) {'),FALLBACK].join('\n'));
function buildScope(name,text){
  const parsed=globalThis.parseWorkspaceDocument({kind:'notes',name:name,path:'',text:text});
  return {scope:'current-document',sourceFreshness:'live',text:text,parsed:parsed,parseError:'',dirty:false,hasWritableHandle:true,handle:{},workspaceAvailable:false,belongsToWorkspace:false,workspacePath:'',membershipReason:'',physicalName:name};
}
const DIR='/data/data/com.termux/files/home/storage/downloads/Mme/Mme-test-new/notes/';
for(const f of ['Test-named.md','2026-09-27.md']){
  const text=fs.readFileSync(DIR+f,'utf8');
  const s=buildScope(f,text);
  const tp=getCurrentDocumentTagsProjection(s);
  const kp=getCurrentDocumentTasksProjection(s);
  const lp=getCurrentDocumentLinksOutProjection(s,null);
  console.log('=== '+f+' ===');
  console.log('title: '+JSON.stringify(s.parsed&&s.parsed.title));
  console.log('tagsProj: '+tp.availability+' count='+tp.count+' '+JSON.stringify(tp.tags));
  console.log('tasksProj: '+kp.availability+' count='+kp.count+' '+JSON.stringify((kp.tasks||[]).map(t=>({line:t.line,done:t.done,es:t.effectiveStatus,text:String(t.text||'').slice(0,40)}))));
  console.log('linksOutProj: '+lp.availability+' count='+lp.count+' '+JSON.stringify((lp.linksOut||[]).map(r=>({label:r.displayLabel,raw:r.rawTarget,status:r.status}))));
}
