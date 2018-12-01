
export namespace comptime {

  export const env = {} as {[name: string]: string | undefined}
  export const pkg = {version: '?', name: '?'} as {
    version: string
    name: string
    [name: string]: any
  }

  // ??
  export const runtime = true

  export const test = !!env.TEST
  export const debug = !!env.DEBUG
  export const dev = !!env.DEV
  export const prod = !env.DEV
  export function toto(a: number) { return { a } }
}

export function decorate_if(expr: boolean) {
  function decorate(target: any): any
  function decorate(target: any, key: any, prop: any): any
  function decorate(target: any, ...a: any[]) {
    return target
  }

  return decorate
}
