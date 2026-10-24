import { serveGeneric } from '../serve'
import { defineComponent } from './shared'

/** Compressing every block costs CPU. */
const COMPRESS_CPU = 1.5

/** Block servers: split files into blocks, find what changed, compress, and move the blocks to storage. */
export const blocksrv = defineComponent({
  kind: 'blocksrv',
  label: 'Block Servers',
  blurb: 'Split files into 4 MB blocks and move them between clients and storage.',
  solves: 'Large files move in pieces that can be retried, de-duplicated and compressed.',
  worsens: 'More moving parts between the client and storage.',
  capacityRps: 500,
  baseLatencyMs: 15,
  costPerMin: 15,
  serves: ['chunk'],
  relays: false,
  needsRouter: true,
  count: {
    field: 'instances',
    label: 'Servers',
    min: 1,
    max: 30,
    scrollHint: 'Scroll to add or remove block servers',
    solves: 'Each handles about 500 file transfers a second.',
    worsens: '15/min each. Needs a load balancer in front.',
  },
  choices: [
    {
      field: 'blockDelta',
      label: 'On save, upload',
      options: [
        { value: false, label: 'Whole file', solves: 'Simple.', worsens: 'Fixing one typo in a 10 MB file uploads all 10 MB again.' },
        { value: true, label: 'Changed blocks', solves: 'Only the blocks that changed travel (delta sync): about a tenth of the bytes.', worsens: 'Blocks must be hashed and tracked.' },
      ],
    },
    {
      field: 'blockCompress',
      label: 'Compression',
      options: [
        { value: false, label: 'Off', solves: 'No CPU spent.', worsens: 'Every byte travels and is stored as is.' },
        { value: true, label: 'On', solves: 'Blocks shrink about 40% before they move or are stored.', worsens: 'About 50% more CPU per transfer.' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${instances} server${instances > 1 ? 's' : ''} · ${config.blockDelta ? 'delta sync' : 'whole files'}${config.blockCompress ? ' · compressed' : ''}`,
  review: ({ config }) => (config.blockDelta ? [] : ['Uploading whole files on every save moves far more bytes than the edit.']),
  serve: (node, ctx) => serveGeneric(node, { ...ctx, instances: ctx.instances / (node.config.blockCompress ? COMPRESS_CPU : 1) }),
})
