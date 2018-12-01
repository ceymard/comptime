# comptime, a conditional compilation typescript plugin

This project is a typescript transformer that provides conditional compilation and compile-time variable substitution in a somewhat type-safe manner.

Note that this plugin is still in a pretty alpha state and will crash on you the first chance it gets. **You have been warned**.

The documentation here is pretty minimal for now and will be supplemented at a later time. Please just know that there are probably many cave-at that you should be aware of that I didn't have time to detail here.

## What it allows you to do

 * Conditionally compile code
 * Replace variables at compile time with values known then (such as environment variables or package.json values)
 * Define compile-time variables and functions directly in your source code
 * All of the above done in a type-safe manner

## Why
https://github.com/webpack/docs/wiki/list-of-plugins#defineplugin
There are some conditional compilation soluthttps://github.com/webpack/docs/wiki/list-of-plugins#definepluginions out there [such as the define plugin](https://github.com/webpack/docs/wiki/list-ohttps://github.com/webpack/docs/wiki/list-of-plugins#definepluginf-plugins#defineplugin), but they're all out of typescript's scope.

Consider this :

```javascript
///ifdef SOME_CONDITION
var myvar = ''
///endif

console.log(myvar)
```

while this example is stupid, it still highlights the fact that you will never be warned until your code crashes at runtime.

## What it (probably) won't do

Macros and code emission are for now out of scope of this project.

While code-rewrite is an interesting feature, it is pretty hard to implement it while still keeping the type logic intact, as macros could potentially do pretty much whatever they want.

# How to use

The simplest way to use it is in conjunction with [ttypescript](https://github.com/cevek/ttypescript). Just add in your `tsconfig.json` the following after having installed it with `npm --save comptime` :

```javascript
// ...
  "compilerOptions": {
    /// ...
    "plugins": [
      { "transform": "comptime/comptime" }
    ]
  }
// ...
```

There is no need to configure your IDE to use something else than the normal typescript language server ; this plugin affects only the emitted code.

Once loaded, `require 'comptime'` somewhere in your code to be able to start using it. Once required, it will pollute your global scope with a `comptime` variable that holds at least `comptime.env` and `comptime.pkg`, where `env` is a dictionary with the current compiler's environment variables, and `pkg` is the `package.json` object that the current source file relates to.

## Conditions

Compile-time expressions are those using only values from the `comptime` namespace or literals (strings, booleans, ...).

```typescript
if (comptime.env.NODE_ENV === 'production') {
  // do things here
} else if (comptime.env.NODE_ENV === 'dev') {
  // or do that
}

export const MY_VAR = comptime.env.NODE_ENV === 'production' ? 'prod-value' : 'dev-value'
```

## Creating your own variables

In a file that you are sure will be loaded first by typescript (typically with a name that sorts before or in a file imported by pretty much everyone) :

```typescript
// to have the global comptime namespace here
import 'comptime'

declare global {
  namespace comptime {
    // We declare new variables
    export var debug: boolean
    export var prod: boolean
    export function test(a: number): string
  }
}

// All these expressions are evaluated at compile time and removed from the source
comptime.debug = !!comptime.env['DEBUG']
comptime.prod = comptime.env['NODE_ENV'] === 'production'

// this function can now be called at compile time in other files.
comptime.test = function (a: number) { return '' + a + 3 }
```
