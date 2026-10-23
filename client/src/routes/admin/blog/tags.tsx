import { privateMeta } from '../../../lib/clientMeta'
import Terms from '../../../pages/admin/blog/Terms.jsx'

export const meta = privateMeta('Tags | Growth Scholar Blog')

export default function Tags() {
  return (
    <Terms
      taxonomy="tag"
      title="Tags"
      singular="Tag"
      help="Tags are free-form keywords. A post can carry as many as it needs."
    />
  )
}
