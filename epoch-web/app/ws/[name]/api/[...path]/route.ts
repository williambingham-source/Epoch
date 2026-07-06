import { NextRequest } from 'next/server';
import { auth } from '@/auth';

function bridgeUrl() {
  return process.env.BRIDGE_URL ?? 'http://localhost:3002';
}

async function proxy(
  req: NextRequest,
  workspaceName: string,
  pathSegments: string[],
): Promise<Response> {
  const session = await auth();
  const target = `${bridgeUrl()}/api/${pathSegments.join('/')}${req.nextUrl.search}`;
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  const headers: Record<string, string> = { 'x-workspace': workspaceName };
  if (hasBody) headers['content-type'] = req.headers.get('content-type') ?? 'application/json';
  if (session?.accessToken) headers['x-gitea-token'] = session.accessToken;
  if (session?.user?.login) headers['x-gitea-user'] = session.user.login;

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
  });
  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    },
  });
}

type Context = { params: Promise<{ name: string; path: string[] }> };

export async function GET(req: NextRequest, ctx: Context) {
  const { name, path } = await ctx.params;
  return proxy(req, name, path);
}
export async function POST(req: NextRequest, ctx: Context) {
  const { name, path } = await ctx.params;
  return proxy(req, name, path);
}
export async function PUT(req: NextRequest, ctx: Context) {
  const { name, path } = await ctx.params;
  return proxy(req, name, path);
}
export async function DELETE(req: NextRequest, ctx: Context) {
  const { name, path } = await ctx.params;
  return proxy(req, name, path);
}
