# comptime, a conditional compilation typescript plugin

This project is a typescript transformer that provides conditional compilation and compile-time variable substitution in a somewhat type-safe manner.

Note that this plugin is still in a pretty alpha state and will crash on you the first chance it gets. **You have been warned**.

The documentation here is pretty minimal for now and will be supplemented at a later time. Please just know that there are probably many cave-at that you should be aware of that I didn't have time to detail here.

Note that by design, if you compile without the plugin, the code will have *everything* included (all the ifs and whatnot) and will run like if `Production` is `true` and `Env` is an empty object.

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



## Conditions

Compile-time expressions are those using only values from the `comptime` namespace or literals (strings, booleans, ...).

```typescript
import { Comptime } from 'comptime'

if (Comptime.Env.NODE_ENV === 'production') {
  // do things here
} else if (Comptime.Env['NODE_ENV'] === 'dev') {
  // or do that
}

export const MY_VAR = Comptime.Env.NODE_ENV === 'production' ? 'prod-value' : 'dev-value'
```

## Default flags and environment variable

You have the following starting variables to play with :

 * `Comptime.Production` defaults to `true`, is `false` if `COMPTIME_ENV=dev`
 * `Comptime.Dev` defaults to `false`, is `true` if `COMPTIME_ENV=dev` or if `DEBUG=<anything>`
 * `Comptime.Debug` defaults to `false`, is `true` if `DEBUG` is set
 * `Comptime.Env` is an object with your environment

## Creating your own variables

In your code and in a file that you are sure will be loaded first by typescript (typically with a name that sorts before or in a file imported by pretty much everyone) :

```typescript
import { Comptime } from 'comptime'

// Module augmentation baby !
declare module 'comptime' {
  namespace Comptime {
    // We declare new variables
    export function Test(a: number): string
  }
}

// this function can now be called at compile time in other files.
Comptime.Test = function (a: number) { return '' + a + 3 }
```
