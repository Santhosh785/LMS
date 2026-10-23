import { privateMeta } from '../../../lib/clientMeta'
import Terms from '../../../pages/admin/blog/Terms.jsx'

export const meta = privateMeta('Categories | Growth Scholar Blog')

export default function Categories() {
  return (
    <Terms
      taxonomy="blog-category"
      title="Categories"
      singular="Category"
      help="Categories group posts by subject and drive the blog's category rail. A post carries one."
    />
  )
}
