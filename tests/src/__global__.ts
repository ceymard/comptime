import 'comptime'

declare global {
  namespace Comptime {
    export function Test(a: number): string
  }
}

Comptime.Test = function (a: number) { return '' + a + 3 }
