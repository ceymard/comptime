import 'comptime'

declare global {
  namespace comptime {
    export var debug: boolean
    export var prod: boolean
    export function test(a: number): string
  }
}

comptime.debug = true
comptime.prod = false
comptime.test = function (a: number) { return '' + a + 3 }
