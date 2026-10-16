import type { Server } from 'node:http';
export function startServer(root: string, port: number): Promise<Server>;
export function stopServer(server: Server): Promise<void>;
