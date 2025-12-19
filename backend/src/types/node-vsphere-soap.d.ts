declare module 'node-vsphere-soap' {
  export class Client {
    constructor(host: string, username: string, password: string, ignoreSSL: boolean);
    
    once(event: string, callback: (error?: Error) => void): void;
    retrieve(options: { type: string; properties: string[] }): Promise<any>;
    close(): Promise<void>;
  }
}
