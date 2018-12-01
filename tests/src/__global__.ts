import 'comptime'

declare global {
  namespace comptime {
    export var debug: boolean
    export var prod: boolean
    export function test(a: number): string
  }
}

comptime.debug = !!comptime.env.DEBUG
comptime.prod = !comptime.debug
comptime.test = function (a: number) { return '' + a + 3 }
