export interface PageContext {
  url: string
  routeParams: Record<string, string>
  [key: string]: any
}
