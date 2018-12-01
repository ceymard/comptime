
import * as ts from 'typescript'
import * as path from 'path'
import * as finder from 'find-package-json'
const se = require('safe-eval')

const K = ts.SyntaxKind
const DECL_FILE = path.join(__dirname, 'index.ts')
const DECL_FILEDTS = path.join(__dirname, 'index.d.ts')

const comptime = {
  env: {},
  pkg: {}
}
Object.assign(comptime.env, process.env)

export interface PluginOptions {

}

function nodeName(node: ts.Node) {
  return ts.SyntaxKind[node.kind]
}

function expressionIsComptime(expr: ts.Node, chk: ts.TypeChecker): boolean {
  // console.log('?? ' + nodeName(expr) + ' ' + expr.getText())

  if (ts.isConditionalExpression(expr)) {
    return expressionIsComptime(expr.condition, chk)
      && expressionIsComptime(expr.whenFalse, chk)
      && expressionIsComptime(expr.whenTrue, chk)
  }

  if (ts.isPrefixUnaryExpression(expr)) {
    // Am I using ! or - with a comptime expression ?
    return expressionIsComptime(expr.operand, chk)
  }

  if (ts.isPropertyAccessExpression(expr)
    || ts.isElementAccessExpression(expr)
    || ts.isParenthesizedExpression(expr)
    ) {
    // Am I accessing a property on a comptime expression ?
    return expressionIsComptime(expr.expression, chk)
  }

  if (ts.isBinaryExpression(expr)) {
    // Are both comptime ?
    return expressionIsComptime(expr.left, chk) && expressionIsComptime(expr.right, chk)
  }

  if (ts.isLiteralExpression(expr)
    || expr.kind === K.TrueKeyword
    || expr.kind === K.FalseKeyword
    || expr.kind === K.UndefinedKeyword
    || expr.kind === K.NullKeyword) {
    return true
  }

  if (ts.isCallExpression(expr)) {
    // For a call to be comptime, we need the call expression and all the arguments
    // to all be comptime.
    return expressionIsComptime(expr.expression, chk)
      && expr.arguments.filter(a => expressionIsComptime(a, chk)).length === expr.arguments.length
  }

  if (ts.isIdentifier(expr)) {
    const type = chk.getTypeAtLocation(expr)
    const sym = type.getSymbol()
    if (sym && sym.declarations.length > 0) {
      const f = sym.declarations[0].getSourceFile().fileName
      if (expr.text === 'comptime' && (f === DECL_FILE || f === DECL_FILEDTS))
        return true
    }
  }

  // console.log('not found: ' + nodeName(expr), expr.getText())

  return false
}




function visitorFactory(src: ts.SourceFile, ctx: ts.TransformationContext, chk: ts.TypeChecker, options: PluginOptions) {

  const pkg = finder(path.dirname(src.fileName)).next().value

  function evalExp(node: ts.Node) {
    (comptime.pkg as any) = pkg
    try {
      var res = se(node.getText(), {comptime: comptime})
      return res
    } catch (e) {
      console.error(e)
    }
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
      if (expressionIsComptime(node, chk)) {
        // console.log(`eval ${node.getText()}`)
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
      if (expressionIsComptime(exp, chk)) {
        if (evalExp(exp)) return visitall(node.thenStatement)
        if (node.elseStatement)
          return visitall(node.elseStatement)
        return ts.createNotEmittedStatement(node)
      }
    }

    // We checked above that the conditional expression was not itself fully comptime.
    // Here, we check only its condition part to rewrite the then / else portion just like
    // the if statement
    if (ts.isConditionalExpression(node)) {
      if (expressionIsComptime(node.condition, chk)) {
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