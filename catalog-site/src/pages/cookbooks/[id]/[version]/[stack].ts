import { getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import { renderCookbookHandoff } from '../../../../lib/cookbook-handoff';
import {
  STACKS,
  versionLabel,
  type CookbookData,
  type StackId,
} from '../../../../lib/cookbooks';

interface RouteProps {
  cookbook: CookbookData;
  stackId: StackId;
}

export const prerender = true;

export const getStaticPaths = (async () => {
  const cookbooks = await getCollection('cookbooks');
  return cookbooks.flatMap((entry) =>
    STACKS.map((stack) => ({
      params: {
        id: entry.data.id,
        version: versionLabel(entry.data.version),
        stack: stack.id,
      },
      props: {
        cookbook: entry.data as CookbookData,
        stackId: stack.id,
      },
    })),
  );
}) satisfies GetStaticPaths;

export const GET: APIRoute<RouteProps> = async ({ props }) => {
  const body = await renderCookbookHandoff(props.cookbook, props.stackId);
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
};
