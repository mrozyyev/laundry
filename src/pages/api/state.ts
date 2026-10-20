import type { APIRoute } from 'astro';
import { getState } from '../../lib/state';

export const prerender = false;

export const GET: APIRoute = () =>
  Response.json(getState(), {
    headers: { 'cache-control': 'no-store' }
  });
