import { blogPosts } from '../schema/index.js'
import { omitColumns } from './content.js'

/**
 * Archive and card lists never need the block body or the revision history,
 * which are by far the largest columns a post has.
 */
export const withoutColumns = (excluded) => omitColumns(blogPosts, excluded)

export const listColumns = () => withoutColumns(['body', 'revisions'])
