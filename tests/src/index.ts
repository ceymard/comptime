import 'comptime'

declare global {
  namespace comptime {
    export var debug: boolean
    export var prod: boolean
  }
}

comptime.debug = false
comptime.prod = true
