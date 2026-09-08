const fs = require('node:fs');
const ts = require('typescript');
const roots = ['src', 'n8n', 'scripts', 'firebase'];
const failures = [];

/**
 * Lists maintained JavaScript and TypeScript sources, excluding generated dependencies.
 */
function sourceFiles() {
  return ['karma.conf.cjs', ...roots.flatMap(/** Maps and flattens the current item. @param root Current callback input. */ (root) => fs.readdirSync(root, { recursive: true })
    .filter(/** Checks whether the current item matches the filter. @param file Current callback input. */ (file) => /\.(cjs|js|ts)$/.test(file)).map(/** Maps the current item to its output value. @param file Current callback input. */ (file) => root + '/' + file))];
}



/**
 * Counts physical lines containing code while excluding blank lines and documentation.
 * @param text Source text to inspect.
 */
function codeLines(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  const lines = new Set();
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    const prefix = text.slice(0, scanner.getTokenPos());
    lines.add(prefix.split('\n').length);
  }
  return lines.size;
}



/**
 * Checks one function's size and documents named functions, methods and constructors.
 * @param node Syntax or workflow node.
 * @param source Parsed source file.
 * @param filename Source or export filename.
 */
function checkFunction(node, source, filename) {
  if (!node.body) return;
  const location = `${filename}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  if (codeLines(node.body.getText(source)) > 14) failures.push(location + ': function exceeds 14 code lines');
  const docs = node.jsDoc ?? [];
  const inlineDoc = source.text.slice(node.pos, node.getStart(source)).includes('/**');
  if (!docs.length && !inlineDoc) failures.push(location + ': missing JSDoc');
  checkSpacing(node, source, location);
}



/**
 * Requires three blank lines before the next method or independent code block.
 * @param node Syntax or workflow node.
 * @param source Parsed source file.
 * @param location Source location for diagnostics.
 */
function checkSpacing(node, source, location) {
  if (!ts.isFunctionDeclaration(node) && !ts.isMethodDeclaration(node)
    && !ts.isGetAccessorDeclaration(node) && !ts.isConstructorDeclaration(node)) return;
  const rest = source.text.slice(node.end);
  if (!rest.trim() || rest.trimStart().startsWith('}')) return;
  const whitespace = rest.match(/^\s*/)[0];
  if ((whitespace.match(/\n/g) ?? []).length !== 4) failures.push(location + ': expected exactly 3 blank lines');
}



/**
 * Visits every function, including callbacks, in one parsed source.
 * @param node Syntax or workflow node.
 * @param source Parsed source file.
 * @param filename Source or export filename.
 */
function visit(node, source, filename) {
  if (ts.isFunctionLike(node)) checkFunction(node, source, filename);
  ts.forEachChild(node, /** Handles the current value in the enclosing operation. @param child Current callback input. */ (child) => visit(child, source, filename));
}



/**
 * Checks a complete source file or an embedded n8n Code node.
 * @param filename Source or export filename.
 * @param text Source text to inspect.
 */
function checkSource(filename, text) {
  if (codeLines(text) > 400) failures.push(filename + ': exceeds 400 code lines');
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  visit(source, source, filename);
}



for (const filename of sourceFiles()) checkSource(filename, fs.readFileSync(filename, 'utf8'));
for (const filename of fs.readdirSync('n8n').filter(/** Checks whether the current item matches the filter. @param file Current callback input. */ (file) => file.endsWith('.workflow.json'))) {
  const workflow = JSON.parse(fs.readFileSync('n8n/' + filename, 'utf8'));
  for (const node of workflow.nodes) if (node.parameters.jsCode) checkSource(filename + '/' + node.name, node.parameters.jsCode);
}
if (failures.length) throw new Error(failures.join('\n'));
process.stdout.write('Code style checks passed (400/14 lines, JSDoc, three blank lines).\n');
