
import * as ts from 'typescript'

import * as cmp from './index'
import * as path from 'path'
const se = require('safe-eval')

const DECL_FILE = path.join(__dirname, 'index.ts')
const DECL_FILEDTS = path.join(__dirname, 'index.d.ts')

const K = ts.SyntaxKind

Object.assign(cmp.comptime.env, process.env)

// Où signature est la signature d'une fonction, pour être sûrs qu'on récupère bien un
// type déclaré par le bon script.
// path.resolve(signature.declaration.getSourceFile().fileName) === path.resolve(path.join(__dirname, '..', '..', 'index.d.ts'))

export namespace Comptime {
  export declare const env: {[name: string]: string | undefined}

}


export interface PluginOptions {

}

function nodeName(node: ts.Node) {
  return ts.SyntaxKind[node.kind]
}

function expressionIsComptime(expr: ts.Node, chk: ts.TypeChecker): boolean {
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

  if (ts.isLiteralExpression(expr)) {
    return true
  }

  if (ts.isCallExpression(expr)) {
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

  return false
}


function evalExp(node: ts.Node) {
  try {
    var res = se(node.getText(), {comptime: cmp.comptime})
    return res
  } catch (e) {
    console.error(e)
    // ???
  }
}


function visitorFactory(src: ts.SourceFile, ctx: ts.TransformationContext, chk: ts.TypeChecker, options: PluginOptions) {
  function visit(node: ts.Node): ts.Node {
    if (ts.isIfStatement(node)) {
      var exp = node.expression
      // console.log(nodeName(exp), expressionIsComptime(exp, chk))
      if (expressionIsComptime(exp, chk)) {
        if (evalExp(exp)) return visitall(node.thenStatement)
        return ts.createNotEmittedStatement(node)
      }
      return node
    }

    if (ts.isPropertyAccessExpression(node)
      || ts.isElementAccessExpression(node)
      || ts.isCallExpression(node)
      || ts.isBinaryExpression(node)) {

      // This is where we replace the call / whatever
      if (expressionIsComptime(node, chk)) {
        const res = evalExp(node)
        console.log('--', typeof res, res, node.getText())
        if (res == undefined)
        return ts.createIdentifier('' + res)
        return ts.createLiteral(res)
        // console.log(res)
      }
    }
    // console.log(node.getText(), nodeName(node.parent))

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