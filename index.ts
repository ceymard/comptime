
declare namespace Comptime {

  export const Env: {[name: string]: string | undefined}

  export const Pkg: {
    version: string
    name: string
    [name: string]: any
  }

  export const Debug: boolean
  export const Dev: boolean
  export const Production: boolean

}
