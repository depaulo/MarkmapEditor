'use strict';
/**
 * Minimal DOM shim for ACT 5B device acceptance.
 *
 * Deliberately small: it supports only what js/workspace/projects-view.js and
 * js/workspace/workspace-host.js actually use. It is NOT a browser and makes no
 * layout/paint claims — visual acceptance remains the owner's job.
 */

const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

class ClassList {
  constructor(el) { this.el = el; }
  add(...c) { for (const x of c) if (x && !this.el._classes.has(x)) this.el._classes.add(x); }
  remove(...c) { for (const x of c) this.el._classes.delete(x); }
  contains(c) { return this.el._classes.has(c); }
  toString() { return Array.from(this.el._classes).join(' '); }
}

// ACT 5C browser-faithful collection: querySelectorAll() must NOT return an
// Array. A real NodeList offers length, indexed access, item(), forEach and
// iteration — and NONE of the Array-only methods (no find/map/filter/some/
// every/reduce/indexOf). The previous Array return is exactly what let the
// shipped `querySelectorAll(...).find()` crash reach the device.
class NodeList {
  constructor(items) {
    this._items = items;
    this.length = items.length;
    for (let i = 0; i < items.length; i += 1) this[i] = items[i];
  }
  item(i) { return i >= 0 && i < this._items.length ? this._items[i] : null; }
  forEach(cb, thisArg) {
    if (typeof cb !== 'function') throw new TypeError('NodeList.forEach: callback is not a function');
    for (let i = 0; i < this._items.length; i += 1) cb.call(thisArg, this._items[i], i, this);
  }
  keys() { return this._items.keys(); }
  values() { return this._items.values(); }
  entries() { return this._items.entries(); }
  [Symbol.iterator]() { return this._items[Symbol.iterator](); }
}

class El {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.attributes = {};
    this._classes = new Set();
    this._listeners = {};
    this.hidden = false;
    this.parentNode = null;
    this.classList = new ClassList(this);
    this._text = '';
  }
  get id() { return this.attributes.id || ''; }
  set id(v) { this.attributes.id = String(v); }
  get className() { return this.classList.toString(); }
  set className(v) { this._classes = new Set(String(v || '').split(/\s+/).filter(Boolean)); }
  setAttribute(k, v) {
    if (k === 'class') { this.className = v; this.attributes.class = this.className; }
    else { this.attributes[k] = String(v); }
  }
  get classAttribute() { return this.className; }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  // ACT 5C device correction: the view toggles `disabled` on the global Apply /
  // Discard controls while patching locally, so removal must be representable.
  removeAttribute(k) { delete this.attributes[k]; }
  focus() { if (globalThis.document) globalThis.document.activeElement = this; }
  blur() { if (globalThis.document) globalThis.document.activeElement = null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this); }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter((f) => f !== fn);
  }
  dispatchEvent(ev) {
    ev.target = ev.target || this;
    let node = this;
    while (node) {
      for (const fn of (node._listeners[ev.type] || []).slice()) fn.call(node, ev);
      node = node.parentNode;
    }
    return true;
  }
  closest(sel) {
    const m = String(sel).match(/^\[([^\]=]+)(?:="([^"]*)")?\]$/);
    let node = this;
    while (node) {
      if (m) {
        if (node.hasAttribute(m[1]) && (m[2] === undefined || node.getAttribute(m[1]) === m[2])) return node;
      } else if (node.tagName === String(sel).toUpperCase()) return node;
      node = node.parentNode;
    }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    const m = String(sel).match(/^\[([^\]=]+)(?:="([^"]*)")?\]$/);
    const walk = (n) => {
      for (const c of n.children) {
        if (sel === '*') out.push(c);
        else if (m) { if (c.hasAttribute(m[1]) && (m[2] === undefined || c.getAttribute(m[1]) === m[2])) out.push(c); }
        else if (c.tagName === String(sel).toUpperCase()) out.push(c);
        walk(c);
      }
    };
    walk(this);
    // Browser-faithful: a NodeList, not an Array (see class NodeList above).
    return new NodeList(out);
  }
  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length ? all[0] : null;
  }
  // Minimal <select> value semantics: value follows the option marked
  // `selected`, exactly as a browser reports control state.
  get value() {
    if (this.tagName === 'SELECT') {
      if (this._value !== undefined && this._value !== null) return this._value;
      const sel = this.children.find((c) => c.getAttribute && c.getAttribute('selected') === 'selected');
      if (sel) return sel.getAttribute('value') || '';
      const first = this.children[0];
      return first ? (first.getAttribute('value') || '') : '';
    }
    return this._value === undefined || this._value === null ? '' : this._value;
  }
  // ACT 5C focus fixtures: a browser places the caret at the end of a text
  // input when its value is assigned, and exposes selection state.
  set value(v) {
    this._value = v === null || v === undefined ? '' : String(v);
    this._selStart = this._value.length;
    this._selEnd = this._value.length;
  }
  get selectionStart() {
    const len = String(this.value == null ? '' : this.value).length;
    return this._selStart == null ? len : Math.min(this._selStart, len);
  }
  get selectionEnd() {
    const len = String(this.value == null ? '' : this.value).length;
    return this._selEnd == null ? len : Math.min(this._selEnd, len);
  }
  setSelectionRange(start, end) {
    this._selStart = Number(start) || 0;
    this._selEnd = end === undefined || end === null ? this._selStart : Number(end) || 0;
  }

  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map((c) => c.textContent).join('');
  }
  set textContent(v) { this.children = []; this._text = String(v == null ? '' : v); }
  get innerHTML() { return serialize(this); }
  set innerHTML(html) { this.children = []; this._value = undefined; parseInto(this, String(html || '')); }
  insertAdjacentHTML(pos, html) {
    const holder = new El('div');
    parseInto(holder, String(html || ''));
    if (pos === 'afterbegin') this.children = holder.children.concat(this.children);
    else this.children = this.children.concat(holder.children);
    for (const c of this.children) c.parentNode = this;
  }
}

function serialize(el) {
  const attrs = Object.entries(el.attributes).map(([k, v]) => ` ${k}="${v}"`).join('');
  if (el.children.length === 0) return `<${el.tagName.toLowerCase()}${attrs}>${el._text}</${el.tagName.toLowerCase()}>`;
  return `<${el.tagName.toLowerCase()}${attrs}>${el.children.map(serialize).join('')}</${el.tagName.toLowerCase()}>`;
}

// Tolerant parser for the markup these modules generate: tags, attributes,
// text nodes. Enough to read back rows/buttons; not a spec-compliant parser.
function parseInto(root, html) {
  const stack = [root];
  // Allows both key="value" and bare boolean attributes (e.g. `selected`).
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [full, tag, attrStr, text] = m;
    if (text !== undefined) {
      const t = text.trim();
      if (t) stack[stack.length - 1]._text += t;
      continue;
    }
    if (full.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
    const el = new El(tag);
    const ar = /([a-zA-Z-]+)="([^"]*)"|\s([a-zA-Z-]+)(?=\s|$)/g;
    let a;
    while ((a = ar.exec(attrStr || '')) !== null) {
      const key = a[1] || a[3];
      const val = a[1] !== undefined ? a[2] : '';
      if (key === 'class') { el.className = val; el.attributes.class = el.className; }
      else el.attributes[key] = val;
    }
    if (/\shidden(\s|$|=)/.test(attrStr || '')) el.hidden = true;
    el.parentNode = stack[stack.length - 1];
    stack[stack.length - 1].children.push(el);
    if (!VOID.has(tag.toLowerCase()) && !/\/>\s*$/.test(full) && !full.endsWith('/>')) stack.push(el);
  }
  return root;
}

function createDocument() {
  const doc = new El('#document');
  doc.documentElement = new El('html');
  doc.body = new El('body');
  // Real focus tracking: the ACT 5C focus-stability fixtures assert that the
  // focused node is never replaced while typing.
  doc.activeElement = null;
  // The real page always has #layout; view containers append into it.
  const layout = new El('div');
  layout.id = 'layout';
  doc.body.appendChild(layout);
  doc.documentElement.appendChild(doc.body);
  doc.appendChild(doc.documentElement);
  // No cache: containers are appended after load, exactly as at runtime.
  doc.getElementById = (id) => {
    let found = null;
    const walk = (n) => {
      for (const c of n.children) {
        if (c.getAttribute('id') === id && !found) found = c;
        walk(c);
      }
    };
    walk(doc);
    return found;
  };
  doc.createElement = (t) => new El(t);
  doc.addEventListener = El.prototype.addEventListener.bind(doc);
  doc.removeEventListener = El.prototype.removeEventListener.bind(doc);
  doc.dispatchEvent = El.prototype.dispatchEvent.bind(doc);
  return doc;
}

function createWindow(document) {
  const win = {};
  win.document = document;
  win._listeners = {};
  win.addEventListener = (t, fn) => { (win._listeners[t] = win._listeners[t] || []).push(fn); };
  win.removeEventListener = (t, fn) => { if (win._listeners[t]) win._listeners[t] = win._listeners[t].filter((f) => f !== fn); };
  win.dispatchEvent = (ev) => { for (const fn of (win._listeners[ev.type] || []).slice()) fn(ev); return true; };
  win.isSecureContext = true;
  win.top = win;
  win.self = win;
  return win;
}

function install() {
  const document = createDocument();
  const window = createWindow(document);
  global.document = document;
  global.window = window;
  global.Event = class Event { constructor(type, init) { this.type = type; this.preventDefault = () => {}; this.stopPropagation = () => {}; Object.assign(this, init || {}); } };
  return { document, window };
}

module.exports = { install, createDocument, createWindow, El };
