
import * as ts from 'typescript'
import * as path from 'path'
const se = require('safe-eval')

const K = ts.SyntaxKind
const DECL_FILE = path.join(__dirname, 'index.ts')
const DECL_FILEDTS = path.join(__dirname, 'index.d.ts')

const Comptime = {
  Env: {},
  Production: true,
  Dev: false,
  Debug: false
}
Object.assign(Comptime.Env, process.env)

if (process.env.COMPTIME_ENV === 'dev') {
  Comptime.Dev = true
  Comptime.Production = false
}

if (!!process.env.DEBUG) {
  Comptime.Production = false
  Comptime.Dev = true
  Comptime.Debug = true
}

export interface PluginOptions {

}

const TAGGED = Symbol('tagged-as-comp')
export function tag_comp(node: ts.Node, value: boolean) {
  (node as any)[TAGGED] = value
  // if (value) {
  //   console.log('true: ', node.getText())
  // }
  return value
}

/**
 * Visit a typescript source file to amend it.
 * @param src The source file being parsed
 * @param ctx The context
 * @param chk The checker (used to tell if a variable really is comptime)
 * @param options Plugin options, not really used
 */
function visitorFactory(src: ts.SourceFile, ctx: ts.TransformationContext, chk: ts.TypeChecker, options: PluginOptions) {

  /**
   * Evaluate a compile-time expression, running it in a sandbox.
   * @param node the comptime expression
   */
  function evalExp(node: ts.Node) {

    const opts = Object.assign({}, ctx.getCompilerOptions(), {noImplicitUseString: true})
    var t = ts.transpile(node.getText(), opts).replace(/"use strict";\s*\n?/, '');
    try {
      // console.log(t)
      var res = se(t, { Comptime })
    } catch (e) {
      console.log(`comptime error in ${src.fileName}:${node.pos}`)
      throw e
    }
    return res
  }

  function allAreComp(exprs: ts.NodeArray<ts.Node>) {
    var len = exprs.length
    for (var i = 0; i < len; i++) {
      if (!isComp(exprs[i]))
        return false
    }
    return true
  }

  /**
   * Check if a node represents an expression that can be evaluated at compile time.
   * @param expr the AST expression to check
   */
  function isComp(expr: ts.Node): boolean {
    const cached = (expr as any)[TAGGED]
    if (cached != null) return cached
    // ts.syntaxKind[node.kind] // this is the node name
    // console.log('?? ' + nodeName(expr) + ' ' + expr.getText())

    // This checks for `comptime.a ? .. : ..`
    if (ts.isConditionalExpression(expr)) {
      return tag_comp(expr,
        isComp(expr.condition)
        && isComp(expr.whenFalse)
        && isComp(expr.whenTrue)
      )
    }

    // This checks for `!comptime.whatever` and `-comptime.whatever`
    if (ts.isPrefixUnaryExpression(expr)) {
      // Am I using ! or - with a comptime expression ?
      return tag_comp(expr, isComp(expr.operand))
    }

    // This checks for expressions like
    // `comptime.something.else`
    // `comptime.val['accessor']`
    // `(comptime.val||{})`
    if (ts.isPropertyAccessExpression(expr)
      || ts.isElementAccessExpression(expr)
      || ts.isParenthesizedExpression(expr)
      ) {
      // Am I accessing a property on a comptime expression ?
      return tag_comp(expr, isComp(expr.expression))
    }

    if (ts.isBinaryExpression(expr)) {
      // Are both comptime ?
      return tag_comp(expr, isComp(expr.left) && isComp(expr.right))
    }

    if (ts.isArrayLiteralExpression(expr)) {
      return tag_comp(expr, allAreComp(expr.elements))
    }

    // if (ts.isObjectLiteralExpression(expr)) {
    //   return expr.properties.length === expr.properties.map(p => expressionIsComptime(p))
    // }

    if (ts.isLiteralExpression(expr)
      // || ts.isFunctionExpression(expr)
      // || ts.isArrowFunction(expr)
      || expr.kind === K.TrueKeyword
      || expr.kind === K.FalseKeyword
      || expr.kind === K.UndefinedKeyword
      || expr.kind === K.NullKeyword) {
      return tag_comp(expr, true)
    }

    // This checks for function calls, which we allow.
    if (ts.isCallExpression(expr)) {
      // For a call to be comptime, we need the call expression and all the arguments
      // to all be comptime.
      return tag_comp(expr, isComp(expr.expression) && allAreComp(expr.arguments))
    }

    if (ts.isIdentifier(expr)) {
      const type = chk.getTypeAtLocation(expr)
      const sym = type.getSymbol()
      if (sym && sym.declarations.length > 0) {
        const f = sym.declarations[0].getSourceFile().fileName
        if (expr.text === 'Comptime' && (f === DECL_FILE || f === DECL_FILEDTS)) {
          return tag_comp(expr, true)
        }
      }
    }

    // console.log('not found: ' + nodeName(expr), expr.getText())

    return tag_comp(expr, false)
  }

  function visit(node: ts.Node): ts.Node {

    if (ts.isImportDeclaration(node) && node.moduleSpecifier.getText().slice(1, -1) === 'comptime') {
      // Remove all references to import 'comptime'
      return ts.createNotEmittedStatement(node)
    }

    // Check if the expression is comptime and substitute its value
    if (ts.isPropertyAccessExpression(node)
      || ts.isElementAccessExpression(node)
      || ts.isCallExpression(node)
      || ts.isBinaryExpression(node)
      || ts.isConditionalExpression(node)) {

      // This is where we replace the call / whatever
      // console.log(`? ${node.getText()}`)

      if (isComp(node)
        // We check here that the comptime expression is not the left hand of a function call.
        // If we get here, it most likely means that a function call using a comptime value
        // was calling non-comptime values.
        && !(ts.isCallExpression(node.parent) && node.parent.arguments.length > 0 && node.parent.expression === node))
      {
        // console.log(ts.SyntaxKind[node.kind], isComp(node))
        const res = evalExp(node)

        // If the expression was an assignement, remove it from the source entirely.
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken)
          return ts.createNotEmittedStatement(node)

        if (res == undefined || typeof res === 'boolean')
          return ts.createIdentifier('' + res)
        return ts.createLiteral(res)
      }
    }

    if (ts.isIfStatement(node)) {
      var exp = node.expression

      // If the if statement is resolvable at compile time, then evaluate
      // it and return either the `then` or `else` statement depending on
      // the result of the expression.
      // If there is no else statement and the condition is not valid, then
      // do not emit anything at all
      if (isComp(exp)) {
        if (evalExp(exp)) return visitall(node.thenStatement)
        if (node.elseStatement)
          return visitall(node.elseStatement)
        return ts.createNotEmittedStatement(node)
      }
    }

    // We checked above that the conditional expression was not itself fully comptime (at
    // least the true or false part of it was not).
    // Here, we check only its condition part to rewrite the then / else portion just like
    // the if statement
    if (ts.isConditionalExpression(node)) {
      if (isComp(node.condition)) {
        if (evalExp(node.condition))
          return visitall(node.whenTrue)
        return visitall(node.whenFalse)
      }
    }

    return visitall(node)
  }

  const visitall = (node: ts.Node) => ts.visitEachChild(node, visit, ctx)

  return visit
}


export default function (prog: ts.Program, options: PluginOptions) {
  const checker = prog.getTypeChecker()
  return (ctx: ts.TransformationContext) => {
    return (src: ts.SourceFile) => {
      // console.log(src.fileName)
      const res = ts.visitEachChild(src, visitorFactory(src, ctx, checker, options), ctx)
      return res
    }
  }
}