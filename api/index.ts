import { ApiServer } from '../src/api/server';

const server = new ApiServer();

export default function handler(req: any, res: any) {
  // Use the public 'app' property
  return server.app(req, res);
}
