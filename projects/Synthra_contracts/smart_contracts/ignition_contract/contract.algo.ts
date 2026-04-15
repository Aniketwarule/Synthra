import { Contract } from '@algorandfoundation/algorand-typescript'

export class IgnitionContract extends Contract {
  hello(name: string): string {
    return `Hello, ${name}`
  }
}
